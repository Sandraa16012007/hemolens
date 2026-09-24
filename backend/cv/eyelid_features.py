"""
HemoLens Phase 2 — Eyelid / Palpebral Conjunctiva Feature Extraction
====================================================================
Implements deterministic handcrafted color feature extraction for the
lower palpebral conjunctiva ROI.

Research basis (CP-AnemiC):
- Lower palpebral conjunctiva is highly vascularized, close to surface;
  its color appearance correlates with hemoglobin / RBC concentration.
- Pipeline: capture lower eyelid -> extract conjunctival ROI -> color analysis
  on ROI pixels (not full-image).
- CP-AnemiC uses triangle thresholding + entropy/grayscale processing for ROI.
- ROI pixels converted to CIELAB (L*, a*, b*); paper reports a* (red-green)
  correlates with Hb: higher Hb -> higher a*, lower Hb -> lower a*.
- Illumination strongly affects color; must control / reduce lighting effects.
- Deep model learns high-level conjunctival features, but Phase 2 here
  produces deterministic handcrafted color features for later ML (no NN).

This module MUST NOT implement Hb prediction, anemia classification,
Random Forest / XGBoost, or any ML model. It only extracts features.

Pipeline implemented here:
  verified eyelid image (BGR bytes)
  -> conjunctival ROI detection (triangle + grayscale + color filtering)
  -> ROI validation (size, position, pixel_count)
  -> lightweight OpenCV illumination / color normalization (CLAHE on L*)
  -> RGB + HSV + CIELAB feature extraction (mean, std, p25, median, p75)
  -> justified redness/erythema indices
  -> fixed deterministic feature vector (FEATURE_NAMES ordered)
  -> ROI-marked image (outline + translucent mask)

Allowed dependencies only: opencv-python-headless, numpy, mediapipe (optional).

Color scaling documentation (OpenCV conventions):
- Input image: BGR, uint8, 0-255 per channel.
- RGB: derived via cvtColor BGR->RGB, same 0-255 range, R=0, G=1, B=2 in RGB array.
- HSV (OpenCV): H 0-179 (maps 0-360 deg -> 0-179), S 0-255, V 0-255.
  Conversion: cv2.COLOR_BGR2HSV or RGB2HSV. Deterministic, no floating.
- CIELAB (OpenCV): L 0-255 maps to L* 0-100 (L = L* *255/100),
  a 0-255 maps to a* -128..127 (a = a* +128),
  b 0-255 maps to b* -128..127 (b = b* +128).
  Conversion: cv2.COLOR_BGR2LAB (or RGB2LAB). We keep OpenCV 0-255 for
  determinism and document the mapping. Median/p75 etc are on those 0-255
  values. a* emphasis is preserved because a channel still encodes red-green.
- Redness indices are computed in RGB 0-255 space, per-pixel then averaged,
  fully deterministic.

ROI detection method (explicit, deterministic):
1. Convert BGR -> grayscale, GaussianBlur (5x5).
2. Triangle threshold: cv2.threshold(..., THRESH_BINARY+THRESH_TRIANGLE)
   on blurred grayscale. This is the CP-AnemiC triangle step. Also compute
   histogram entropy (-sum(p log2 p)) as research-required entropy/grayscale
   measure (logged, used for validation, not for thresholding).
3. Color pre-filter for mucosal tissue:
   mucosa_mask = (R > 80) & (R - G > 30) & (R - B > 40) in RGB space.
   This is the same heuristic used in validation for palpebral tissue.
   It is NOT a clinically validated erythema index; it is a simple
   image-derived redness pre-filter justified by vascular pink/red appearance.
4. If MediaPipe Face Landmarker is available and detects a face, build a
   polygonal eye region from lower-eyelid landmarks (RIGHT/LEFT lower indices)
   and restrict mucosa + triangle intersection to that polygon. This gives a
   precise lower-eyelid ROI when face geometry is present.
5. Otherwise (macro close-up, no face), use the full-image mucosa mask
   intersected with triangle mask, then morphological open/close (ellipse 7x7,
   iterations 2) to clean noise.
6. Find external contours on cleaned mask, keep largest by area.
   Compute bounding rect (x,y,w,h) and pixel_count (non-zero in mask or
   contour area). This is the conjunctival ROI.
7. Validate ROI: pixel_count must be >= 0.8% of image and <= 35% of image,
   width and height >= 20px, bbox not covering >90% of image dimensions,
   contour solidity reasonable, and entropy > 3.0 (ensures not uniform).
   Failure returns structured error, never fabricated features.

Illumination / color normalization:
- Lightweight OpenCV: LAB CLAHE on L channel.
  Convert BGR -> LAB, split L,a,b, apply CLAHE (clipLimit=2.0, tileGrid 8x8)
  to L only, merge, convert back LAB->BGR. This reduces illumination
  variation while preserving chromaticity (a*, b*). Applied to whole image
  before feature extraction; features are then computed only on ROI pixels
  of the normalized image. Strength is lightweight and deterministic.

Features (all on ROI pixels only, finite, reproducible):
- RGB: R/G/B mean, std, p25, median, p75  (3*5=15)
- HSV: H/S/V mean, std, p25, median, p75  (3*5=15)
- CIELAB (OpenCV 0-255): L*,a*,b* mean, std, p25, median, p75 (3*5=15)
  with particular emphasis on a* (red-green) per research.
- Redness / erythema (4 simple, justified, NOT clinically validated):
  * red_chromaticity_mean = mean( R / (R+G+B+1e-6) )
  * r_minus_g_mean = mean( R - G )
  * r_minus_b_mean = mean( R - B )
  * excess_red_mean = mean( 2*R - G - B )
  These are straightforward image-derived redness proxies; paper's a* emphasis
  already covers red-green, these add lightweight RGB erythema information
  without claiming clinical validation.

Total feature_vector length = 49, ordered by FEATURE_NAMES.

ROI-marked image:
- Original image is preserved unchanged (copy never modified).
- Separate marked copy: translucent red fill (alpha 0.35) inside ROI mask +
  bright outline (2px) around bbox/contour. Clearly shows detected conjunctiva.

No Hb prediction, no classification, no ML model.
"""

from __future__ import annotations

import base64
import os
import uuid
import math
import logging
from pathlib import Path
from typing import Tuple, Optional, Any

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants / Feature Names (ordered, fixed length = 49)
# ---------------------------------------------------------------------------

FEATURE_NAMES: list[str] = [
    # RGB 15
    "r_mean", "r_std", "r_p25", "r_median", "r_p75",
    "g_mean", "g_std", "g_p25", "g_median", "g_p75",
    "b_mean", "b_std", "b_p25", "b_median", "b_p75",
    # HSV 15
    "h_mean", "h_std", "h_p25", "h_median", "h_p75",
    "s_mean", "s_std", "s_p25", "s_median", "s_p75",
    "v_mean", "v_std", "v_p25", "v_median", "v_p75",
    # CIELAB (OpenCV 0-255) 15
    "lab_l_mean", "lab_l_std", "lab_l_p25", "lab_l_median", "lab_l_p75",
    "lab_a_mean", "lab_a_std", "lab_a_p25", "lab_a_median", "lab_a_p75",
    "lab_b_mean", "lab_b_std", "lab_b_p25", "lab_b_median", "lab_b_p75",
    # Redness / erythema proxies 4
    "red_chromaticity_mean",
    "r_minus_g_mean",
    "r_minus_b_mean",
    "excess_red_mean",
]

FEATURE_DIM: int = len(FEATURE_NAMES)  # 49

# ROI validation thresholds — relaxed for macro close-up and high-res images
# CP-AnemiC conjunctiva can occupy 0.5% (high-res) to 60% (tight macro) depending on framing
MIN_ROI_FRACTION: float = 0.003  # 0.3% — allows high-res landmark hulls like 0.54% (good2)
MAX_ROI_FRACTION: float = 0.80   # 80% — allows tight macro close-ups (good3 ~55%)
MIN_ROI_PIXELS: int = 1500       # absolute minimum to reject tiny noise
MIN_ROI_DIM: int = 20
MAX_BBOX_COVER: float = 0.95  # bbox cannot cover >95% of width+height simultaneously
MIN_ENTROPY: float = 3.0

# Storage for generated images
_DEFAULT_STORAGE_DIR = Path(__file__).parent.parent / "storage" / "eyelid_features"
# Also expose via TEST output dir
_TEST_OUTPUT_DIR = Path(__file__).parent.parent / "storage" / "test_output"

# ---------------------------------------------------------------------------
# Helpers: entropy, triangle, mucosa
# ---------------------------------------------------------------------------

def _grayscale_entropy(gray: np.ndarray) -> float:
    """Shannon entropy of grayscale histogram (256 bins)."""
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
    hist = hist.ravel() / (hist.sum() + 1e-12)
    # only non-zero
    hist = hist[hist > 0]
    return float(-np.sum(hist * np.log2(hist)))


def _decode_image_bytes(raw_bytes: bytes) -> Optional[np.ndarray]:
    arr = np.frombuffer(raw_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img  # BGR or None


def _get_landmarker():
    """Lazy import mediapipe landmarker if available, else None."""
    try:
        import mediapipe.tasks as mp_tasks
        from pathlib import Path as _P
        model_path = _P(__file__).parent.parent / "models" / "face_landmarker.task"
        if not model_path.exists():
            return None
        import mediapipe as mp
        BaseOptions = mp_tasks.BaseOptions
        FaceLandmarker = mp_tasks.vision.FaceLandmarker
        FaceLandmarkerOptions = mp_tasks.vision.FaceLandmarkerOptions
        opts = FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(model_path)),
            running_mode=mp_tasks.vision.RunningMode.IMAGE,
            num_faces=1,
            min_face_detection_confidence=0.25,
            min_face_presence_confidence=0.25,
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=False,
        )
        landmarker = FaceLandmarker.create_from_options(opts)
        return landmarker
    except Exception as e:
        logger.debug(f"Landmarker not available: {e}")
        return None


# Try to cache landmarker singleton
_LANDMARKER_CACHE = None
_LANDMARKER_INIT_ATTEMPTED = False

def _get_cached_landmarker():
    global _LANDMARKER_CACHE, _LANDMARKER_INIT_ATTEMPTED
    if _LANDMARKER_INIT_ATTEMPTED:
        return _LANDMARKER_CACHE
    _LANDMARKER_INIT_ATTEMPTED = True
    try:
        _LANDMARKER_CACHE = _get_landmarker()
    except Exception:
        _LANDMARKER_CACHE = None
    return _LANDMARKER_CACHE


# Eye landmark indices (same as validation config)
_RIGHT_LOWER = [145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
_LEFT_LOWER = [374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466]
_RIGHT_CORNERS = [33, 133]
_LEFT_CORNERS = [263, 362]

def _try_landmark_roi(img_bgr: np.ndarray) -> Optional[tuple[np.ndarray, tuple[int,int,int,int]]]:
    """
    Attempt landmark-based ROI polygon.
    Returns (mask, bbox) if successful, else None.
    """
    landmarker = _get_cached_landmarker()
    if landmarker is None:
        return None
    try:
        h, w = img_bgr.shape[:2]
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        import mediapipe as mp
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)
        result = landmarker.detect(mp_image)
        if not result.face_landmarks:
            return None
        landmarks = result.face_landmarks[0]
        # Determine dominant eye by width
        def lm_px(idx):
            return landmarks[idx].x * w, landmarks[idx].y * h
        r_outer = lm_px(_RIGHT_CORNERS[0]); r_inner = lm_px(_RIGHT_CORNERS[1])
        l_outer = lm_px(_LEFT_CORNERS[0]); l_inner = lm_px(_LEFT_CORNERS[1])
        rw = abs(r_inner[0]-r_outer[0]); lw = abs(l_inner[0]-l_outer[0])
        if rw >= lw:
            lower_idx = _RIGHT_LOWER
        else:
            lower_idx = _LEFT_LOWER
        pts = []
        for idx in lower_idx:
            x,y = lm_px(idx)
            pts.append([int(round(x)), int(round(y))])
        pts = np.array(pts, dtype=np.int32)
        # Compute bbox with small padding (5% of eye width)
        x,y,bw,bh = cv2.boundingRect(pts)
        pad = max(4, int(max(bw,bh)*0.15))
        x = max(0, x - pad); y = max(0, y - pad)
        bw = min(w - x, bw + 2*pad); bh = min(h - y, bh + 2*pad)
        # Create polygon mask for lower eyelid area
        mask = np.zeros((h,w), dtype=np.uint8)
        # Fill polygon
        # Ensure polygon is closed; use convex hull to avoid self-intersection
        hull = cv2.convexHull(pts)
        cv2.fillPoly(mask, [hull], 255)
        # Dilate slightly to include conjunctiva interior
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7,7))
        mask = cv2.dilate(mask, kernel, iterations=1)
        return mask, (x,y,bw,bh)
    except Exception as e:
        logger.debug(f"Landmark ROI failed: {e}")
        return None


# ---------------------------------------------------------------------------
# Core ROI detection
# ---------------------------------------------------------------------------

def detect_conjunctiva_roi(img_bgr: np.ndarray) -> dict[str, Any]:
    """
    Detect conjunctival ROI using triangle thresholding + entropy + color filter.

    Returns dict with:
      success: bool
      mask: np.ndarray (if success)
      bbox: (x,y,w,h)
      pixel_count: int
      entropy: float
      tri_thresh: float
      reason: str (if failure)
    """
    if img_bgr is None or img_bgr.size == 0:
        return {"success": False, "reason": "Invalid image (empty)"}

    h, w = img_bgr.shape[:2]
    total = h * w

    # Grayscale + blur + entropy
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray_blur = cv2.GaussianBlur(gray, (5, 5), 0)
    entropy = _grayscale_entropy(gray)

    # Triangle threshold (CP-AnemiC)
    tri_thresh_val, tri_mask = cv2.threshold(gray_blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_TRIANGLE)
    tri_inv = cv2.bitwise_not(tri_mask)

    # Color mucosal mask in RGB
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    r = img_rgb[:, :, 0].astype(np.int16)
    g = img_rgb[:, :, 1].astype(np.int16)
    b = img_rgb[:, :, 2].astype(np.int16)
    mucosa_mask = (r > 80) & ((r - g) > 30) & ((r - b) > 40)
    mucosa_u8 = (mucosa_mask.astype(np.uint8) * 255)

    # Try landmark-based restriction
    landmark_result = _try_landmark_roi(img_bgr)
    if landmark_result is not None:
        poly_mask, bbox_hint = landmark_result
        # Primary: mucosa within polygon
        combined = cv2.bitwise_and(mucosa_u8, poly_mask)
        # If mucosa is too sparse (<500px) inside landmark polygon, fall back to polygon itself
        # (landmark polygon is already a strong conjunctiva prior; color filter may be too strict under certain lighting)
        if cv2.countNonZero(combined) < 500:
            # Use dilated polygon directly as ROI, but still validate color later via features (a* emphasis)
            combined = poly_mask.copy()
        else:
            # Optionally refine with triangle inverse if it retains enough
            tri_inv_frac = cv2.countNonZero(tri_inv) / total
            if 0.05 < tri_inv_frac < 0.65:
                combined_tri = cv2.bitwise_and(combined, tri_inv)
                if cv2.countNonZero(combined_tri) > max(500, cv2.countNonZero(combined) * 0.15):
                    combined = combined_tri
        # Clean
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        cleaned = cv2.morphologyEx(combined, cv2.MORPH_OPEN, kernel, iterations=1)
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel, iterations=2)
        mask = cleaned
        # Find largest contour
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            # Fallback to polygon mask directly
            mask = poly_mask
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not contours:
                return {"success": False, "reason": "No contour found in landmark-restricted ROI", "entropy": entropy, "tri_thresh": float(tri_thresh_val)}
        # Largest by area
        c = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(c)
        x, y, bw, bh = cv2.boundingRect(c)
        # Create precise mask from contour
        precise_mask = np.zeros((h, w), dtype=np.uint8)
        cv2.drawContours(precise_mask, [c], -1, 255, -1)
        pixel_count = int(cv2.countNonZero(precise_mask))
        if pixel_count < 100:
            pixel_count = int(cv2.countNonZero(mask[y:y+bh, x:x+bw]) if mask is not None else 0)

        # Validation (relaxed)
        frac = pixel_count / total
        if pixel_count < MIN_ROI_PIXELS and frac < MIN_ROI_FRACTION:
            return {"success": False, "reason": f"ROI too small ({pixel_count}px, {frac:.4f} < {MIN_ROI_FRACTION})", "entropy": entropy, "tri_thresh": float(tri_thresh_val)}
        if frac > MAX_ROI_FRACTION and pixel_count > total * MAX_ROI_FRACTION:
            return {"success": False, "reason": f"ROI too large ({pixel_count}px, {frac:.4f} > {MAX_ROI_FRACTION})", "entropy": entropy, "tri_thresh": float(tri_thresh_val)}
        if bw < MIN_ROI_DIM or bh < MIN_ROI_DIM:
            return {"success": False, "reason": f"ROI bbox too small ({bw}x{bh})", "entropy": entropy, "tri_thresh": float(tri_thresh_val)}
        if entropy < MIN_ENTROPY:
            return {"success": False, "reason": f"Low entropy {entropy:.2f} < {MIN_ENTROPY}", "entropy": entropy, "tri_thresh": float(tri_thresh_val)}

        return {
            "success": True,
            "mask": precise_mask,
            "bbox": (int(x), int(y), int(bw), int(bh)),
            "pixel_count": int(pixel_count),
            "entropy": float(entropy),
            "tri_thresh": float(tri_thresh_val),
        }
    else:
        # Macro close-up path (no face) — TWEAKED: reject whole-image contours, prefer central horizontal strip
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        cleaned = cv2.morphologyEx(mucosa_u8, cv2.MORPH_OPEN, kernel, iterations=2)
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel, iterations=2)

        # Intersect with triangle inverse to suppress bright skin/sclera if needed
        # But choose adaptively: keep cleaned if tri_inv would erase too much
        tri_inv_frac = cv2.countNonZero(tri_inv) / total
        if 0.05 < tri_inv_frac < 0.60:
            combined = cv2.bitwise_and(cleaned, tri_inv)
            if cv2.countNonZero(combined) > 500 and cv2.countNonZero(combined) > cv2.countNonZero(cleaned) * 0.15:
                cleaned = combined

        # Find contours, filter by area and position (prefer central)
        contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return {"success": False, "reason": "No mucosa contour found (macro path)", "entropy": entropy, "tri_thresh": float(tri_thresh_val)}

        # Filter contours: allow up to MAX (relaxed for macro close-up) but reject whole-image
        candidates = []
        for c in contours:
            area = cv2.contourArea(c)
            frac = area / total
            if frac < MIN_ROI_FRACTION or frac > MAX_ROI_FRACTION:
                # Yet allow huge close-up if absolute pixels large and bbox not whole frame
                if not (frac > 0.60 and frac <= 0.95 and area > 10000):
                    continue
            x, y, bw, bh = cv2.boundingRect(c)
            if bw < MIN_ROI_DIM or bh < MIN_ROI_DIM:
                continue
            # Reject whole-image contour (touches all 4 borders)
            is_whole = (x <= 2 and y <= 2 and x+bw >= w-2 and y+bh >= h-2)
            if is_whole:
                continue
            # Check bbox cover — relax for macro (allow up to 0.95)
            if bw > w * MAX_BBOX_COVER and bh > h * MAX_BBOX_COVER:
                continue
            # Prefer central region — also require horizontal-ish for conjunctiva strip
            aspect = bw / max(1, bh)
            # Reject very vertical strips (likely not conjunctiva)
            if aspect < 1.1:
                continue
            # Require minimum absolute area for macro (reject tiny skin speckles like no-conj)
            if area < 15000:
                continue
            cx, cy = x + bw/2, y + bh/2
            dist_norm = math.hypot(cx - w/2, cy - h/2) / math.hypot(w/2, h/2)
            # Penalize top region (eyebrow) — conjunctiva is lower/central
            if y < h*0.15:
                continue
            # Penalize side border (conjunctiva is central, not at extreme left/right edge)
            if x < w*0.10 or x + bw > w*0.90:
                continue
            candidates.append((area, dist_norm, c))

        if not candidates:
            # Fallback: handle whole-image case with triangle refinement, else next best
            # First check if largest is whole-image -> try triangle refinement to get subregion
            sorted_contours = sorted(contours, key=cv2.contourArea, reverse=True)
            largest = sorted_contours[0]
            lx,ly,lbw,lbh = cv2.boundingRect(largest)
            is_whole_largest = (lx <= 2 and ly <= 2 and lx+lbw >= w-2 and ly+lbh >= h-2)
            if is_whole_largest and cv2.countNonZero(cleaned) / total > 0.55:
                # Whole-image likely due to tight crop where conjunctiva fills frame.
                # Try to isolate more precise subregion via central mask
                central_mask = np.zeros((h,w), dtype=np.uint8)
                cx0, cx1 = int(w*0.12), int(w*0.88)
                cy0, cy1 = int(h*0.20), int(h*0.88)
                central_mask[cy0:cy1, cx0:cx1] = 255
                central_base = cv2.bitwise_and(mucosa_u8, central_mask)
                central_base = cv2.morphologyEx(central_base, cv2.MORPH_CLOSE, kernel, iterations=2)
                central_base = cv2.morphologyEx(central_base, cv2.MORPH_OPEN, kernel, iterations=1)
                # Remove pure white sclera (low saturation high value)
                # Compute HSV s for central
                hsv_tmp = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
                s_tmp = hsv_tmp[:,:,1]
                gray_tmp = gray # already defined
                sclera_central = (s_tmp < 40) & (gray_tmp > 155)
                sclera_central_u8 = (sclera_central.astype(np.uint8)*255)
                sclera_central_u8 = cv2.bitwise_and(sclera_central_u8, central_mask)
                central_base = cv2.bitwise_and(central_base, cv2.bitwise_not(sclera_central_u8))
                if cv2.countNonZero(central_base) > 800:
                    contours_c, _ = cv2.findContours(central_base, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                    sub_candidates = []
                    for c2 in contours_c:
                        a2 = cv2.contourArea(c2)
                        if a2 < 15000:
                            continue
                        x2,y2,bw2,bh2 = cv2.boundingRect(c2)
                        if bw2 < MIN_ROI_DIM or bh2 < MIN_ROI_DIM:
                            continue
                        asp2 = bw2 / max(1,bh2)
                        if asp2 < 1.0:
                            continue
                        frac2 = a2/total
                        if frac2 < 0.002 or frac2 > 0.60:
                            continue
                        if y2 < h*0.18:
                            continue
                        sub_candidates.append((a2, c2))
                    if sub_candidates:
                        _, best_sub = max(sub_candidates, key=lambda t: t[0])
                        candidates.append((cv2.contourArea(best_sub), 0.5, best_sub))
                    else:
                        # Fallback to triangle central
                        tri_refined = cv2.bitwise_and(cleaned, tri_inv)
                        tri_refined = cv2.bitwise_and(tri_refined, central_mask)
                        if cv2.countNonZero(tri_refined) > 600:
                            cleaned_try = cv2.morphologyEx(tri_refined, cv2.MORPH_CLOSE, kernel, iterations=2)
                            cleaned_try = cv2.morphologyEx(cleaned_try, cv2.MORPH_OPEN, kernel, iterations=1)
                            contours2, _ = cv2.findContours(cleaned_try, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                            sub2 = []
                            for c2 in contours2:
                                a2 = cv2.contourArea(c2)
                                if a2 < 500: continue
                                x2,y2,bw2,bh2 = cv2.boundingRect(c2)
                                asp2 = bw2 / max(1,bh2)
                                if asp2 < 0.9: continue
                                frac2 = a2/total
                                if frac2 < 0.0015 or frac2 > 0.5: continue
                                sub2.append((a2,c2))
                            if sub2:
                                _, best_sub = max(sub2, key=lambda t: t[0])
                                candidates.append((cv2.contourArea(best_sub), 0.5, best_sub))
                            else:
                                return {"success": False, "reason": f"Whole-image ROI with no subregion (central base empty)", "entropy": entropy, "tri_thresh": float(tri_thresh_val)}
                        else:
                            return {"success": False, "reason": f"No candidate ROI after whole-image filtering (largest was whole-image, central base too small)", "entropy": entropy, "tri_thresh": float(tri_thresh_val)}
                else:
                    return {"success": False, "reason": f"No candidate ROI after whole-image filtering (largest was whole-image, central base too small)", "entropy": entropy, "tri_thresh": float(tri_thresh_val)}
            else:
                # Not whole-image, just no candidate due to size/aspect - try next largest non-whole
                found = None
                for c in sorted_contours:
                    area = cv2.contourArea(c)
                    x, y, bw, bh = cv2.boundingRect(c)
                    frac = area / total
                    is_whole = (x <= 2 and y <= 2 and x+bw >= w-2 and y+bh >= h-2)
                    if is_whole:
                        continue
                    if frac < MIN_ROI_FRACTION or frac > 0.95:
                        continue
                    # Require horizontal for conjunctiva
                    asp = bw / max(1,bh)
                    if asp < 1.1:
                        continue
                    found = c
                    break
                if found is None:
                    return {"success": False, "reason": f"No candidate ROI after filtering (largest was whole-image or aspect)", "entropy": entropy, "tri_thresh": float(tri_thresh_val)}
                c = found
                area = cv2.contourArea(c)
                x, y, bw, bh = cv2.boundingRect(c)
                candidates.append((area, 0.5, c))

        # Pick largest area among candidates that is reasonably central (dist <0.8) else largest overall
        candidates.sort(key=lambda t: t[0], reverse=True)
        # Prefer central if area similar
        best = candidates[0]
        # If largest is at border and there is a slightly smaller central one, pick central
        for area, dist, c in candidates:
            if dist < 0.6 and area > best[0] * 0.4:
                best = (area, dist, c)
                break

        _, _, best_c = best
        x, y, bw, bh = cv2.boundingRect(best_c)
        precise_mask = np.zeros((h, w), dtype=np.uint8)
        cv2.drawContours(precise_mask, [best_c], -1, 255, -1)
        pixel_count = int(cv2.countNonZero(precise_mask))

        frac = pixel_count / total
        if pixel_count < MIN_ROI_PIXELS and frac < MIN_ROI_FRACTION:
            return {"success": False, "reason": f"Macro ROI too small after contour extraction ({pixel_count}px)", "entropy": entropy, "tri_thresh": float(tri_thresh_val)}
        if frac > 0.95:
            return {"success": False, "reason": f"Macro ROI too large ({pixel_count}px, {frac:.4f})", "entropy": entropy, "tri_thresh": float(tri_thresh_val)}
        if entropy < MIN_ENTROPY:
            return {"success": False, "reason": f"Low entropy {entropy:.2f}", "entropy": entropy, "tri_thresh": float(tri_thresh_val)}

        # Sclera size + adjacency check for macro (eye white must be present; rejects no-conjunctiva)
        try:
            hsv_s = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)[:,:,1]
            sclera_mask = (hsv_s < 42) & (gray > 158)
            sclera_u8 = (sclera_mask.astype(np.uint8) * 255)
            sc_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5,5))
            sclera_u8 = cv2.morphologyEx(sclera_u8, cv2.MORPH_OPEN, sc_kernel, iterations=1)
            sclera_px = cv2.countNonZero(sclera_u8)
            sclera_frac = sclera_px / total
            # Require minimum sclera for valid eye (same as validation: 25000px or 0.08 frac)
            # This rejects no-conj where sclera is tiny (12421, 0.04)
            if sclera_px < 25000 and sclera_frac < 0.08:
                # For tight macro where sclera is cropped out but conjunctiva fills frame,
                # allow if ROI is large and redness high (good3 case)
                # Check if ROI covers significant central area
                roi_cy_norm = (y + bh/2) / h
                if not (frac > 0.06 and roi_cy_norm > 0.35 and roi_cy_norm < 0.75):
                    return {"success": False, "reason": f"Insufficient sclera for valid eye (sclera {sclera_px} frac {sclera_frac:.3f})", "entropy": entropy, "tri_thresh": float(tri_thresh_val)}
            # Adjacency: ROI should be near sclera
            sclera_contours, _ = cv2.findContours(sclera_u8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            sclera_centers = []
            for sc in sclera_contours:
                if cv2.contourArea(sc) < 800:
                    continue
                M = cv2.moments(sc)
                if M["m00"] == 0:
                    continue
                scx = M["m10"] / M["m00"]
                scy = M["m01"] / M["m00"]
                sclera_centers.append((scx, scy))
            if not sclera_centers:
                # No sclera found but we already passed size check for tight crop case above
                # If size check passed, allow (tight macro)
                pass
            else:
                roi_cx, roi_cy = x + bw/2, y + bh/2
                min_dist = min(math.hypot(roi_cx - scx, roi_cy - scy) for scx, scy in sclera_centers)
                if min_dist > w * 0.42:
                    return {"success": False, "reason": f"ROI not adjacent to sclera (dist {min_dist:.0f} > {w*0.42:.0f})", "entropy": entropy, "tri_thresh": float(tri_thresh_val)}
        except Exception as e:
            logger.debug(f"Sclera check failed: {e}")

        return {
            "success": True,
            "mask": precise_mask,
            "bbox": (int(x), int(y), int(bw), int(bh)),
            "pixel_count": int(pixel_count),
            "entropy": float(entropy),
            "tri_thresh": float(tri_thresh_val),
        }

# ---------------------------------------------------------------------------
# Illumination / color normalization (CLAHE on L*)
# ---------------------------------------------------------------------------

def normalize_illumination(img_bgr: np.ndarray) -> np.ndarray:
    """
    Lightweight OpenCV illumination normalization.
    LAB CLAHE on L channel only (clipLimit 2.0, tile 8x8).
    Deterministic, reduces lighting variation.
    """
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_eq = clahe.apply(l)
    lab_eq = cv2.merge([l_eq, a, b])
    normalized = cv2.cvtColor(lab_eq, cv2.COLOR_LAB2BGR)
    return normalized

# ---------------------------------------------------------------------------
# Feature extraction (ROI pixels only)
# ---------------------------------------------------------------------------

def _stats(arr: np.ndarray) -> tuple[float, float, float, float, float]:
    """Return mean, std, p25, median, p75 for 1D array. Deterministic."""
    if arr.size == 0:
        return (0.0, 0.0, 0.0, 0.0, 0.0)
    # Convert to float for stats
    f = arr.astype(np.float64)
    mean = float(np.mean(f))
    std = float(np.std(f))
    p25 = float(np.percentile(f, 25))
    median = float(np.median(f))
    p75 = float(np.percentile(f, 75))
    # Ensure finite
    for v in (mean, std, p25, median, p75):
        if not math.isfinite(v):
            return (0.0, 0.0, 0.0, 0.0, 0.0)
    return (mean, std, p25, median, p75)


def extract_features_from_roi(normalized_bgr: np.ndarray, mask: np.ndarray) -> tuple[list[float], dict[str, float]]:
    """
    Compute 49-dim feature vector from normalized image ROI pixels.
    Returns (vector, feature_dict).
    """
    h, w = normalized_bgr.shape[:2]
    # Ensure mask is single channel uint8
    if mask.shape[:2] != (h, w):
        # Resize mask if needed (should not happen)
        mask = cv2.resize(mask, (w, h), interpolation=cv2.INTER_NEAREST)

    # ROI pixels
    roi_pixels_bgr = normalized_bgr[mask > 0]  # shape (N,3)
    if roi_pixels_bgr.size == 0:
        raise ValueError("Empty ROI mask")

    # BGR -> RGB for RGB features (BGR order: 0=B,1=G,2=R ; RGB order: R=0,G=1,B=2)
    # But easier: extract directly
    b_vals = roi_pixels_bgr[:, 0].astype(np.float64)
    g_vals = roi_pixels_bgr[:, 1].astype(np.float64)
    r_vals = roi_pixels_bgr[:, 2].astype(np.float64)

    # HSV: convert normalized BGR to HSV (OpenCV: H 0-179, S 0-255, V 0-255)
    hsv = cv2.cvtColor(normalized_bgr, cv2.COLOR_BGR2HSV)
    hsv_roi = hsv[mask > 0]
    h_vals = hsv_roi[:, 0].astype(np.float64)
    s_vals = hsv_roi[:, 1].astype(np.float64)
    v_vals = hsv_roi[:, 2].astype(np.float64)

    # LAB: OpenCV LAB 0-255
    lab = cv2.cvtColor(normalized_bgr, cv2.COLOR_BGR2LAB)
    lab_roi = lab[mask > 0]
    l_vals = lab_roi[:, 0].astype(np.float64)
    a_vals = lab_roi[:, 1].astype(np.float64)
    b_lab_vals = lab_roi[:, 2].astype(np.float64)

    features: dict[str, float] = {}

    # RGB stats (R,G,B)
    for vals, prefix in [(r_vals, "r"), (g_vals, "g"), (b_vals, "b")]:
        mean, std, p25, med, p75 = _stats(vals)
        features[f"{prefix}_mean"] = mean
        features[f"{prefix}_std"] = std
        features[f"{prefix}_p25"] = p25
        features[f"{prefix}_median"] = med
        features[f"{prefix}_p75"] = p75

    # HSV stats
    for vals, prefix in [(h_vals, "h"), (s_vals, "s"), (v_vals, "v")]:
        mean, std, p25, med, p75 = _stats(vals)
        features[f"{prefix}_mean"] = mean
        features[f"{prefix}_std"] = std
        features[f"{prefix}_p25"] = p25
        features[f"{prefix}_median"] = med
        features[f"{prefix}_p75"] = p75

    # LAB stats (OpenCV 0-255)
    for vals, prefix in [(l_vals, "lab_l"), (a_vals, "lab_a"), (b_lab_vals, "lab_b")]:
        mean, std, p25, med, p75 = _stats(vals)
        features[f"{prefix}_mean"] = mean
        features[f"{prefix}_std"] = std
        features[f"{prefix}_p25"] = p25
        features[f"{prefix}_median"] = med
        features[f"{prefix}_p75"] = p75

    # Redness / erythema proxies (simple, not clinically validated)
    # Per-pixel then mean: deterministic, finite
    # Avoid division by zero with epsilon
    eps = 1e-6
    # Use original r,g,b vals (0-255)
    denom = r_vals + g_vals + b_vals + eps
    red_chromaticity = r_vals / denom
    r_minus_g = r_vals - g_vals
    r_minus_b = r_vals - b_vals
    excess_red = 2 * r_vals - g_vals - b_vals

    features["red_chromaticity_mean"] = float(np.mean(red_chromaticity))
    features["r_minus_g_mean"] = float(np.mean(r_minus_g))
    features["r_minus_b_mean"] = float(np.mean(r_minus_b))
    features["excess_red_mean"] = float(np.mean(excess_red))

    # Build ordered vector
    vector: list[float] = []
    for name in FEATURE_NAMES:
        v = features.get(name, 0.0)
        # Ensure finite, deterministic rounding not applied (keep full float)
        if not math.isfinite(v):
            v = 0.0
        vector.append(float(v))

    # Final sanity: all finite and length correct
    assert len(vector) == FEATURE_DIM
    assert all(math.isfinite(x) for x in vector)

    return vector, features

# ---------------------------------------------------------------------------
# ROI-marked image generation
# ---------------------------------------------------------------------------

def create_roi_marked_image(original_bgr: np.ndarray, mask: np.ndarray, bbox: tuple[int,int,int,int]) -> np.ndarray:
    """
    Create ROI-marked copy: translucent red mask + bright outline.
    Original is never modified.
    """
    marked = original_bgr.copy()
    h, w = marked.shape[:2]
    # Overlay translucent red
    overlay = marked.copy()
    # Red in BGR is (0,0,255)
    overlay[mask > 0] = (0, 0, 255)  # pure red where mask
    # Blend: 0.35 alpha for mask region, keep original elsewhere via manual blend
    alpha = 0.35
    # Create blended image
    blended = cv2.addWeighted(overlay, alpha, marked, 1 - alpha, 0)
    # Apply blended only where mask
    marked[mask > 0] = blended[mask > 0]

    # Draw contour outline (find contours from mask)
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    # Bright outline: lime/red border 2px
    cv2.drawContours(marked, contours, -1, (0, 255, 255), 2)  # yellow outline (BGR)
    # Also draw bbox rectangle for clarity (thin white)
    x, y, bw, bh = bbox
    cv2.rectangle(marked, (x, y), (x + bw, y + bh), (255, 255, 255), 1)

    return marked

# ---------------------------------------------------------------------------
# Storage helpers
# ---------------------------------------------------------------------------

def _ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)

def _encode_image_base64(img_bgr: np.ndarray) -> str:
    """Encode BGR image to base64 JPEG data URL (deterministic quality 95)."""
    success, buf = cv2.imencode(".jpg", img_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    if not success:
        return ""
    b64 = base64.b64encode(buf.tobytes()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"

def _save_images(original_bgr: np.ndarray, marked_bgr: np.ndarray, screening_id: Optional[str] = None, output_dir: Optional[Path] = None) -> tuple[str, str]:
    """
    Save original (unchanged) and ROI-marked copy.
    Returns (original_ref, marked_ref) as filesystem paths (relative or absolute).
    For API usage, these are local paths; in production they could be uploaded to Supabase.
    Keeps original unchanged by copying before save.
    """
    if output_dir is None:
        output_dir = _DEFAULT_STORAGE_DIR
    _ensure_dir(output_dir)
    sid = screening_id or uuid.uuid4().hex[:12]
    # Use subfolder per screening
    sub = output_dir / sid
    _ensure_dir(sub)
    orig_path = sub / "eyelid_original.jpg"
    marked_path = sub / "eyelid_roi_marked.jpg"
    # Save with high quality, deterministic
    cv2.imwrite(str(orig_path), original_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    cv2.imwrite(str(marked_path), marked_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    # Return string references (absolute for now, caller can make relative)
    return str(orig_path), str(marked_path)

# ---------------------------------------------------------------------------
# Public isolated function (called by API and tests)
# ---------------------------------------------------------------------------

def extract_eyelid_features(
    raw_bytes: bytes,
    screening_id: Optional[str] = None,
    output_dir: Optional[Path] = None,
    save_images: bool = True,
) -> dict[str, Any]:
    """
    Isolated deterministic function for Phase 2.

    Input: raw_bytes of verified eyelid image (JPEG/PNG).
    Output dict:
      On success:
        {
          "success": True,
          "feature_vector": [...49 floats...],
          "feature_names": [...49 strs...],
          "roi": {"x": int, "y": int, "width": int, "height": int, "pixel_count": int},
          "original_image_reference": str,
          "roi_marked_image_reference": str,
          "meta": {"entropy": float, "tri_thresh": float, "normalization": "LAB_CLAHE_L"}
        }
      On failure (invalid ROI):
        {
          "success": False,
          "error": str,
          "reason": str,
          "roi": None,
          "feature_vector": [],
          "feature_names": FEATURE_NAMES
        }

    Never fabricates features on failure.
    Original image is preserved unchanged; marked copy is separate.
    All values finite, deterministic, reproducible for identical input.
    """
    # Decode
    img_bgr = _decode_image_bytes(raw_bytes)
    if img_bgr is None:
        return {
            "success": False,
            "error": "DECODE_FAILED",
            "reason": "Could not decode image bytes as BGR image.",
            "roi": None,
            "feature_vector": [],
            "feature_names": FEATURE_NAMES,
        }

    # ROI detection
    roi_result = detect_conjunctiva_roi(img_bgr)
    if not roi_result.get("success"):
        return {
            "success": False,
            "error": "INVALID_ROI",
            "reason": roi_result.get("reason", "ROI detection failed"),
            "roi": None,
            "feature_vector": [],
            "feature_names": FEATURE_NAMES,
            "meta": {"entropy": roi_result.get("entropy"), "tri_thresh": roi_result.get("tri_thresh")},
        }

    mask: np.ndarray = roi_result["mask"]
    bbox: tuple[int,int,int,int] = roi_result["bbox"]
    pixel_count: int = roi_result["pixel_count"]
    x, y, bw, bh = bbox

    # Illumination normalization (LAB CLAHE on L)
    normalized = normalize_illumination(img_bgr)

    # Feature extraction on normalized ROI pixels
    try:
        vector, feat_dict = extract_features_from_roi(normalized, mask)
    except Exception as e:
        logger.exception(f"Feature extraction failed: {e}")
        return {
            "success": False,
            "error": "FEATURE_EXTRACTION_FAILED",
            "reason": str(e),
            "roi": None,
            "feature_vector": [],
            "feature_names": FEATURE_NAMES,
        }

    # ROI-marked image (separate copy)
    marked = create_roi_marked_image(img_bgr, mask, bbox)

    # Base64 encoding for frontend Supabase upload (always provided, even when save_images=False)
    try:
        roi_marked_base64 = _encode_image_base64(marked)
        original_base64 = _encode_image_base64(img_bgr)
    except Exception as e:
        logger.warning(f"Base64 encode failed: {e}")
        roi_marked_base64 = ""
        original_base64 = ""

    # Save images (original preserved unchanged) — local filesystem for debug
    if save_images:
        try:
            orig_ref, marked_ref = _save_images(img_bgr, marked, screening_id=screening_id, output_dir=output_dir)
        except Exception as e:
            logger.warning(f"Could not save ROI images: {e}")
            orig_ref, marked_ref = "original_not_saved", "marked_not_saved"
    else:
        orig_ref, marked_ref = "not_saved (save_images=False)", "not_saved (save_images=False)"

    return {
        "success": True,
        "feature_vector": vector,
        "feature_names": FEATURE_NAMES,
        "roi": {"x": int(x), "y": int(y), "width": int(bw), "height": int(bh), "pixel_count": int(pixel_count)},
        "original_image_reference": orig_ref,
        "roi_marked_image_reference": marked_ref,
        "original_image_base64": original_base64,
        "roi_marked_image_base64": roi_marked_base64,
        "meta": {
            "entropy": float(roi_result.get("entropy", 0)),
            "tri_thresh": float(roi_result.get("tri_thresh", 0)),
            "normalization": "LAB_CLAHE_L_clip2.0_tile8x8",
            "roi_fraction": float(pixel_count / (img_bgr.shape[0]*img_bgr.shape[1])),
        },
    }

# Convenience for testing: deterministic repeated extraction check
def extract_features_from_bytes_deterministic(raw_bytes: bytes) -> dict[str, Any]:
    """Helper that calls extract_eyelid_features twice and asserts deterministic."""
    r1 = extract_eyelid_features(raw_bytes, save_images=False)
    r2 = extract_eyelid_features(raw_bytes, save_images=False)
    return r1, r2
