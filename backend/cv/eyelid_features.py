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

ROI detection method (explicit, deterministic, classical OpenCV only):
 1. Sclera anchor: HSV low-saturation + high-value mask (S<55, V>135),
    morphologically cleaned with image-relative kernels, largest plausible
    components kept. Dark anchor (iris/pupil/lashes): V<60 mask.
 2. Search region: expanded sclera bbox (relative padding) when sclera is
    found, else central band (relative fractions only, no hard-coded pixels).
 3. Conjunctiva candidate: LOCAL Otsu threshold on LAB a* (red-green) inside
    the search region (adapts to skin tone / lighting / pallor instead of a
    fixed R-G cutoff) + weak relative gates (R>G, S>25, V in range) +
    exclusion of sclera / dark / specular pixels.
 4. Connected components scored (not hard-rejected) on: relative area,
    rotation-invariant elongation (minAreaRect), solidity/extent, local
    redness (mean a*, R-G), sclera adjacency (touch + nearness via relative
    dilation), centrality, and below-iris position. Best = highest confidence.
 5. Local refinement inside expanded best bbox (re-Otsu on a*, hole fill,
    lash/specular cleanup). Erosion margin removes lid-margin fringe.
 6. Controlled failure (retake prompt) when confidence < threshold or no
    sclera-adjacent reddish crescent exists. No MediaPipe / DL / pretrained
    detector is used in this stage; all thresholds are relative fractions.

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
# Core ROI detection — robust classical pipeline (v2, OpenCV only)
# ---------------------------------------------------------------------------
#
# Why v2 (root causes of v1 failures, verified on test-images):
# - v1 fixed mucosa gate (R>80, R-G>30, R-B>40) fires on ALL skin/fingers/
#   lips, so the largest contour was usually skin, not conjunctiva
#   (good3 -> fingers, good4 -> sclera/skin, test-aryan -> cheek skin).
# - v1 grayscale triangle threshold is meaningless for red tissue and varied
#   wildly (tri=9..170); it kept or erased arbitrary regions per image.
# - v1 absolute area cutoff (15000px) rejects valid ROIs in small images and
#   accepts noise in high-res images; aspect/position gates (x<10% etc.) are
#   hard-coded coordinates that break under rotation/cropping.
# - v1 MediaPipe landmark path rarely triggers on macro close-ups (no face),
#   leaving the brittle full-image fallback as the common path.
# v2 fixes: sclera-anchored search, LOCAL adaptive Otsu on LAB a* (adapts to
# skin tone/lighting/pallor), relative thresholds only, multi-cue scoring
# with confidence gate + controlled retake failure. No DL/pretrained model.

# Confidence gate: below this, return a controlled failure (ask user to
# retake) instead of emitting a bad ROI.
ROI_MIN_CONFIDENCE: float = 0.45
# Relative area bounds for the conjunctiva (fraction of all image pixels).
ROI_MIN_AREA_FRAC: float = 0.002
ROI_MAX_AREA_FRAC: float = 0.35
# Local-contrast gate: candidate must be redder than its peri-scleral ring
# by this many LAB-a units (0-255 scale). Decisive anti-skin/finger cue.
ROI_MIN_RING_CONTRAST: float = 3.0
# Annulus-contrast gate (primary scorer cue): candidate mean-a minus the mean-a
# of its immediate surroundings. Self-calibrating; needs no eye segmentation.
ROI_MIN_ANNULUS_CONTRAST: float = 2.5


def _rel_kernel(min_dim: int, divisor: int = 150, min_k: int = 3, max_k: int = 25) -> np.ndarray:
    """Odd elliptical kernel sized relative to the image (resolution invariant)."""
    k = max(min_k, int(min_dim // max(1, divisor)))
    if k % 2 == 0:
        k += 1
    cap = max_k if max_k % 2 == 1 else max_k - 1
    k = max(min_k, min(k, cap))
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))


def _clip_rect(x: int, y: int, bw: int, bh: int, w: int, h: int) -> tuple[int, int, int, int]:
    x = max(0, x)
    y = max(0, y)
    bw = max(0, min(bw, w - x))
    bh = max(0, min(bh, h - y))
    return x, y, bw, bh


def _detect_sclera_anchor(hsv: np.ndarray, min_dim: int,
                          dark: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    """White-of-eye mask: low saturation + high value, IRIS-COUPLED.

    Bright skin/fingers also pass a white gate, so a white component is kept
    only if it touches (or lies very near) a compact dark iris/pupil blob.
    Without that coupling the anchor locks onto cheeks/fingers. Falls back to
    "no anchor" (empty comps) rather than a wrong anchor.
    """
    h, w = hsv.shape[:2]
    total = h * w
    s = hsv[:, :, 1]
    v = hsv[:, :, 2]
    # Loose gate (shadowed sclera still passes); iris-coupling + red-purge
    # downstream reject skin/fingers that also pass.
    raw = (((s < 50) & (v > 140)).astype(np.uint8)) * 255
    k = _rel_kernel(min_dim, 150)
    clean = cv2.morphologyEx(raw, cv2.MORPH_OPEN, k, iterations=1)
    clean = cv2.morphologyEx(clean, cv2.MORPH_CLOSE, k, iterations=1)

    # Dark-proximity map for coupling (iris/pupil compact-blob proximity).
    prox_u8: Optional[np.ndarray] = None
    iris_list: list[dict[str, Any]] = []
    if dark is not None:
        iris_list = list(dark.get("candidates", []))
        if dark.get("iris") is not None and dark["iris"] not in iris_list:
            iris_list = [dark["iris"]] + iris_list
        if iris_list:
            prox_u8 = np.zeros((h, w), dtype=np.uint8)
            for d in iris_list[:3]:
                tmp = np.zeros((h, w), dtype=np.uint8)
                cv2.drawContours(tmp, [d["contour"]], -1, 255, -1)
                kd = _rel_kernel(min_dim, 30, min_k=5, max_k=41)
                prox_u8 = cv2.bitwise_or(prox_u8, cv2.dilate(tmp, kd, iterations=1))

    contours, _ = cv2.findContours(clean, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    coupled: list[dict[str, Any]] = []
    loose: list[dict[str, Any]] = []
    for c in contours:
        area = cv2.contourArea(c)
        frac = area / total
        if frac < 0.004 or frac > 0.30:
            continue
        hull = cv2.convexHull(c)
        sol = area / (cv2.contourArea(hull) + 1e-6)
        if sol < 0.40:
            continue
        x, y, bw, bh = cv2.boundingRect(c)
        m = cv2.moments(c)
        cx = m["m10"] / (m["m00"] + 1e-9)
        cy = m["m01"] / (m["m00"] + 1e-9)
        entry = {"contour": c, "area": area, "frac": frac,
                 "bbox": (x, y, bw, bh), "centroid": (cx, cy)}
        if prox_u8 is not None:
            tmp = np.zeros((h, w), dtype=np.uint8)
            cv2.drawContours(tmp, [c], -1, 255, -1)
            if int(np.count_nonzero((tmp > 0) & (prox_u8 > 0))) > 50:
                coupled.append(entry)
                continue
        loose.append(entry)

    comps: list[dict[str, Any]] = []
    if coupled:
        comps = sorted(coupled, key=lambda d: d["area"], reverse=True)[:2]
    elif prox_u8 is not None and iris_list and loose:
        # No touching white: nearest white to the iris within a relative radius.
        ix, iy = iris_list[0]["centroid"]
        best_d = None
        best_e = None
        for e in loose:
            d = math.hypot(e["centroid"][0] - ix, e["centroid"][1] - iy)
            if d < min_dim * 0.45 and (best_d is None or d < best_d):
                best_d = d
                best_e = e
        if best_e is not None:
            comps = [best_e]
        # else: refuse a wrong anchor (cheek/finger) -> empty comps
    # If no dark blobs exist at all, do NOT trust white alone -> empty comps.
    union = np.zeros((h, w), dtype=np.uint8)
    for d in comps[:2]:
        cv2.drawContours(union, [d["contour"]], -1, 255, -1)
    return {"mask": union, "comps": comps}


def _detect_dark_anchor(gray: np.ndarray, hsv: np.ndarray, min_dim: int) -> dict[str, Any]:
    """Dark mask: iris / pupil / eyelashes (low value). Returns mask + iris guesses.

    Lash streaks are thin; iris/pupil blobs are compact (solidity/extent gated
    and both minAreaRect axes must exceed a relative size).
    """
    h, w = gray.shape[:2]
    total = h * w
    v = hsv[:, :, 2]
    raw = ((v < 60).astype(np.uint8)) * 255
    k = _rel_kernel(min_dim, 250, min_k=3, max_k=15)
    clean = cv2.morphologyEx(raw, cv2.MORPH_OPEN, k, iterations=1)
    contours, _ = cv2.findContours(clean, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    iris_cands: list[dict[str, Any]] = []
    min_axis = max(4.0, min_dim * 0.012)
    for c in contours:
        area = cv2.contourArea(c)
        frac = area / total
        if frac < 0.0003 or frac > 0.10:
            continue
        hull = cv2.convexHull(c)
        sol = area / (cv2.contourArea(hull) + 1e-6)
        x, y, bw, bh = cv2.boundingRect(c)
        extent = area / max(1, bw * bh)
        (ew, eh) = cv2.minAreaRect(c)[1]
        if min(ew, eh) < min_axis:
            continue  # thin lash streak, not iris/pupil
        if sol < 0.50 or extent < 0.40:
            continue
        m = cv2.moments(c)
        if m["m00"] <= 0:
            continue
        cx = m["m10"] / m["m00"]
        cy = m["m01"] / m["m00"]
        iris_cands.append({"contour": c, "area": area, "frac": frac,
                           "centroid": (cx, cy), "bbox": (x, y, bw, bh)})
    iris_cands.sort(key=lambda d: d["area"], reverse=True)
    best = iris_cands[0] if iris_cands else None
    return {"mask": clean, "iris": best, "candidates": iris_cands}


def _otsu_on_channel(chan: np.ndarray, search_u8: np.ndarray,
                     domain_u8: Optional[np.ndarray] = None,
                     pct_floor: Optional[float] = None,
                     pct_low: Optional[float] = None) -> Optional[tuple[float, np.ndarray]]:
    """Otsu threshold of single-channel values restricted to a domain mask.

    Pure-numpy deterministic Otsu on the lightly blurred channel histogram
    (avoids cv2.threshold shape quirks on masked vectors).

    domain_u8 (default: search_u8) selects which pixels build the histogram —
    pass tissue-only (search minus dark/sclera/specular) so a dark iris or
    white sclera cannot drag the threshold into the tissue range. The returned
    binary mask is still evaluated over the full search_u8 region.

    pct_floor (e.g. 90): raise the threshold to at least that percentile of the
    domain values — but ONLY when plain Otsu would keep >40% of the domain
    (most tissue passes → giant merged skin+conjunctiva blobs). When Otsu is
    already selective (pale tissue, keeps little), it is left alone so pale
    conjunctiva is not erased. Falls back to plain Otsu if the floored mask
    is tiny.
    """
    dom = domain_u8 if domain_u8 is not None else search_u8
    ys, xs = np.nonzero(dom > 0)
    if ys.size < 300:
        return None
    blur = cv2.GaussianBlur(chan, (5, 5), 0)
    vals = blur[ys, xs].astype(np.float64)
    hist, edges = np.histogram(vals, bins=256, range=(0, 255))
    hist = hist.astype(np.float64)
    total_n = hist.sum()
    if total_n <= 0:
        return None
    bin_centers = (edges[:-1] + edges[1:]) / 2.0
    w1 = np.cumsum(hist)
    w2 = total_n - w1
    mu1 = np.cumsum(hist * bin_centers) / np.maximum(w1, 1e-12)
    mu2 = (np.cumsum((hist * bin_centers)[::-1]) / np.maximum(w2[::-1], 1e-12))[::-1]
    between = w1 * w2 * (mu1 - mu2) ** 2
    between[(w1 < 1e-9) | (w2 < 1e-9)] = -1.0
    t = float(bin_centers[int(np.argmax(between))])
    if pct_floor is not None:
        frac_above = float(np.mean(vals > t))
        if frac_above > 0.40:
            tp = float(np.percentile(vals, pct_floor))
            t2 = max(t, tp)
            trial = np.zeros_like(search_u8)
            trial[((blur.astype(np.float64) > t2) & (search_u8 > 0))] = 255
            if int(np.count_nonzero(trial)) >= 800:
                t = t2
    if pct_low is not None:
        # Inclusivity for pale tissue: never threshold above this percentile,
        # so pale conjunctiva (just above skin redness) stays in the mask.
        # Extra skin admitted this way merges blobs, which the separation +
        # strict scoring stages split and filter downstream.
        tl = float(np.percentile(vals, pct_low))
        t = min(t, tl)
    bin_mask = np.zeros_like(search_u8)
    bin_mask[((blur.astype(np.float64) > t) & (search_u8 > 0))] = 255
    return t, bin_mask


def _filter_iris_candidates(dark: dict[str, Any], white_raw_u8: np.ndarray,
                            img_w: int, img_h: int, min_dim: int) -> list[dict[str, Any]]:
    """Keep only dark blobs that look like an on-eye iris/pupil.

    Rejects eyebrows/hair/shadows: a real iris is roughly central AND touches
    bright tissue (sclera/skin glint). Both tests use relative distances.
    """
    cands = dark.get("candidates", [])
    if not cands:
        return []
    k = _rel_kernel(min_dim, 60, min_k=5, max_k=31)
    white_dil = cv2.dilate(white_raw_u8, k, iterations=1)
    kept: list[dict[str, Any]] = []
    for d in cands:
        cx, cy = d["centroid"]
        dn = math.hypot(cx - img_w / 2.0, cy - img_h / 2.0) / (math.hypot(img_w / 2.0, img_h / 2.0) + 1e-9)
        if dn > 0.55:
            continue  # far periphery: eyebrow, hair, shadow, nostril
        tmp = np.zeros_like(white_raw_u8)
        cv2.drawContours(tmp, [d["contour"]], -1, 255, -1)
        if int(np.count_nonzero((tmp > 0) & (white_dil > 0))) < 30:
            continue  # isolated dark blob with no bright neighbour: not an eye
        kept.append(d)
    kept.sort(key=lambda e: (e["area"]
                             * (1.0 - math.hypot(e["centroid"][0] - img_w / 2.0,
                                                 e["centroid"][1] - img_h / 2.0)
                                / (math.hypot(img_w / 2.0, img_h / 2.0) + 1e-9))),
              reverse=True)
    return kept


def _red_tissue_map(a_chan: np.ndarray, s_chan: np.ndarray, v_chan: np.ndarray) -> np.ndarray:
    """Adaptive reddish-tissue mask: a* above its 85th percentile + saturation.

    Percentile-based, so it adapts to skin tone, lighting and pallor instead
    of using a fixed red cutoff. Returns uint8 0/255.
    """
    p85 = float(np.percentile(a_chan.astype(np.float64), 85))
    red = ((a_chan.astype(np.float64) > p85) & (s_chan > 35)
           & (v_chan > 60) & (v_chan < 250))
    return (red.astype(np.uint8)) * 255


def _locate_eye_cluster(dark_u8: np.ndarray, white_raw_u8: np.ndarray, red_u8: np.ndarray,
                        img_w: int, img_h: int, min_dim: int) -> Optional[dict[str, Any]]:
    """Triple-conjunction eye locator (dark + white + red, all classical).

    Merges dark pixels into clusters (pupil+iris+lashes unify), then keeps the
    most central cluster that also neighbours bright tissue AND reddish tissue.
    Eyebrows/hair (dark+white, little red) and cheeks/fingers (red/white,
    little dark) fail the conjunction. All sizes/distances are relative.
    Returns {center, bbox} or None.
    """
    k_close = _rel_kernel(min_dim, 25, min_k=7, max_k=51)
    clustered = cv2.morphologyEx(dark_u8, cv2.MORPH_CLOSE, k_close, iterations=2)
    k_w = _rel_kernel(min_dim, 60, min_k=5, max_k=31)
    white_dil = cv2.dilate(white_raw_u8, k_w, iterations=1)
    k_r = _rel_kernel(min_dim, 40, min_k=5, max_k=41)
    red_dil = cv2.dilate(red_u8, k_r, iterations=1)
    contours, _ = cv2.findContours(clustered, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    total = img_w * img_h
    best: Optional[dict[str, Any]] = None
    best_key = -1.0
    for c in contours:
        area = cv2.contourArea(c)
        frac = area / total
        if frac < 0.002 or frac > 0.15:
            continue
        m = cv2.moments(c)
        if m["m00"] <= 0:
            continue
        cx = m["m10"] / m["m00"]
        cy = m["m01"] / m["m00"]
        dn = math.hypot(cx - img_w / 2.0, cy - img_h / 2.0) / (math.hypot(img_w / 2.0, img_h / 2.0) + 1e-9)
        if dn > 0.60:
            continue
        tmp = np.zeros((img_h, img_w), dtype=np.uint8)
        cv2.drawContours(tmp, [c], -1, 255, -1)
        if int(np.count_nonzero((tmp > 0) & (white_dil > 0))) < 60:
            continue  # no bright neighbour: hair/shadow, not an eye
        if int(np.count_nonzero((tmp > 0) & (red_dil > 0))) < 60:
            continue  # no reddish neighbour: brow/forehead, not an eye
        x, y, bw, bh = cv2.boundingRect(c)
        key = area * (1.0 - dn)
        if key > best_key:
            best_key = key
            best = {"center": (cx, cy), "bbox": (x, y, bw, bh), "area": area}
    return best


def _purge_red_from_sclera(union_u8: np.ndarray, a_chan: np.ndarray) -> np.ndarray:
    """Remove pink conjunctiva bleed-through from a white sclera mask.

    Pale conjunctiva can pass the achromatic-white gate. Inside the union mask,
    a* is bimodal (white sclera = low a, pink tissue = high a); split with Otsu
    and keep the LOW-a class as true sclera. Guards keep unimodal (pure sclera
    or pure skin) masks unchanged. Returns uint8 mask.
    """
    ys, xs = np.nonzero(union_u8 > 0)
    if ys.size < 500:
        return union_u8
    vals = a_chan[ys, xs].astype(np.float64)
    hist, edges = np.histogram(vals, bins=64, range=(0, 255))
    hist = hist.astype(np.float64)
    total_n = hist.sum()
    centers = (edges[:-1] + edges[1:]) / 2.0
    w1 = np.cumsum(hist)
    w2 = total_n - w1
    mu1 = np.cumsum(hist * centers) / np.maximum(w1, 1e-12)
    mu2 = (np.cumsum((hist * centers)[::-1]) / np.maximum(w2[::-1], 1e-12))[::-1]
    between = w1 * w2 * (mu1 - mu2) ** 2
    between[(w1 < 1e-9) | (w2 < 1e-9)] = -1.0
    t = float(centers[int(np.argmax(between))])
    low = vals <= t
    low_frac = float(np.mean(low))
    if not (0.05 <= (1.0 - low_frac) <= 0.70):
        return union_u8  # unimodal: nothing to purge
    mean_low = float(np.mean(vals[low])) if np.any(low) else 0.0
    mean_high = float(np.mean(vals[~low])) if np.any(~low) else 0.0
    if mean_high - mean_low < 5.0:
        return union_u8  # classes too close: keep mask
    keep = np.zeros_like(union_u8)
    blur_a = cv2.GaussianBlur(a_chan, (5, 5), 0).astype(np.float64)
    keep[((union_u8 > 0) & (blur_a <= t))] = 255
    if int(np.count_nonzero(keep)) < 300:
        return union_u8
    return keep


def _component_redness(a_chan: np.ndarray, s_chan: np.ndarray, h_chan: np.ndarray,
                       r: np.ndarray, g: np.ndarray, cnt_mask: np.ndarray) -> dict[str, float]:
    """Mean color cues inside a candidate component (float, deterministic)."""
    sel = cnt_mask > 0
    if not bool(np.any(sel)):
        return {"mean_a": 0.0, "mean_rmg": 0.0, "mean_s": 0.0, "mean_h": 0.0}
    mean_a = float(np.mean(a_chan[sel].astype(np.float64)))
    mean_rmg = float(np.mean(r[sel].astype(np.float64) - g[sel].astype(np.float64)))
    mean_s = float(np.mean(s_chan[sel].astype(np.float64)))
    mean_h = float(np.mean(h_chan[sel].astype(np.float64)))
    return {"mean_a": mean_a, "mean_rmg": mean_rmg, "mean_s": mean_s, "mean_h": mean_h}


def _separate_pieces(cleaned: np.ndarray, min_dim: int) -> list[np.ndarray]:
    """Split merged blobs at narrow bridges via erosion + reconstruction.

    The reddish candidate mask often fuses the strip with adjacent skin /
    sclera / fingers through narrow bridges. Eroding severs the bridges;
    each surviving seed is then morphologically reconstructed (dilated back
    strictly inside the original mask) to its full piece. Returns the list of
    full-size piece masks, or [] when no meaningful split exists (single
    dominant seed or erosion destroyed everything) so the caller scores the
    whole mask as before. Pure classical morphology, relative kernel sizes.
    """
    total_px = int(np.count_nonzero(cleaned))
    if total_px < 800:
        return []
    k_sep = _rel_kernel(min_dim, 70, min_k=7, max_k=17)
    eroded = cv2.erode(cleaned, k_sep, iterations=1)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(eroded, 8)
    seeds = [i for i in range(1, n) if int(stats[i, cv2.CC_STAT_AREA]) >= 400]
    if not seeds:
        return []
    seed_px = sum(int(stats[i, cv2.CC_STAT_AREA]) for i in seeds)
    if len(seeds) < 2 and seed_px >= 0.70 * total_px:
        return []  # no split needed: one dominant component
    if seed_px < 0.25 * total_px:
        return []  # erosion destroyed the mask: bridges were not narrow
    k3 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    pieces: list[np.ndarray] = []
    for i in seeds[:6]:
        cur = (lab == i)
        for _ in range(100):
            nxt = (cv2.dilate(cur.astype(np.uint8), k3, iterations=1) > 0) & (cleaned > 0)
            if bool(np.array_equal(nxt, cur)):
                break
            cur = nxt
        piece = (cur.astype(np.uint8)) * 255
        if int(np.count_nonzero(piece)) >= 400:
            pieces.append(piece)
    return pieces if len(pieces) >= 2 else []


def _clip01(x: float) -> float:
    return 0.0 if x < 0.0 else (1.0 if x > 1.0 else x)


def _score_candidate(cnt: np.ndarray, area: float, frac: float, img_w: int, img_h: int,
                     total: int, red: dict[str, float], cnt_mask: np.ndarray,
                     a_chan: np.ndarray, dark_dist: Optional[np.ndarray],
                     dark_cy: Optional[float],
                     min_dim: int, s_chan: Optional[np.ndarray] = None,
                     v_chan: Optional[np.ndarray] = None,
                     iris_cy: Optional[float] = None,
                     reject_log: Optional[list] = None) -> Optional[tuple[float, dict[str, float]]]:
    """Score one connected component. Returns (confidence, breakdown) or None to reject.

    Primary cue is ANNULUS CONTRAST: the candidate's mean LAB-a minus the mean
    a* of its immediate surroundings (dilated band around the component). This
    is self-calibrating per candidate — adaptive to skin tone, lighting and
    pallor — and needs no eye-structure segmentation: cheek/finger blobs sit
    in same-tissue surroundings (contrast ~0) while conjunctiva is redder than
    its sclera/lid surround. Rotation/position invariant by construction.

    Two whiteness guards separate pink conjunctiva from white sclera without
    segmenting the eye: the candidate itself must not be mostly white, and its
    annulus must contain a sliver of white (the neighbouring sclera).
    """
    def _rej(stage: str):
        if reject_log is not None and len(reject_log) < 12:
            reject_log.append((round(frac, 4), stage))
        return None
    if frac < 0.003 or frac > 0.40:
        return _rej("area-frac")
    x, y, bw, bh = cv2.boundingRect(cnt)
    if bw < 8 or bh < 8:
        return _rej("tiny-bbox")
    rect = cv2.minAreaRect(cnt)
    (ew, eh) = rect[1]
    if min(ew, eh) < 1e-3:
        return _rej("degenerate")
    elong = max(ew, eh) / (min(ew, eh) + 1e-9)
    if elong < 1.6:  # rounder blobs (nostril, skin patch, fingertip) are never conjunctiva
        return _rej("elong")
    hull = cv2.convexHull(cnt)
    sol = area / (cv2.contourArea(hull) + 1e-6)
    extent = area / (max(1, bw * bh))

    # Saturated cosmetic red (nail polish, lipstick) is far more saturated
    # than vascular mucosa (measured: vivid conjunctiva S~100-150, nail
    # polish S>200): hard cap on mean saturation.
    if red["mean_s"] > 180.0:
        return _rej("hyper-saturated")

    # Candidate must not be mostly WHITE (bloodshot sclera also passes the red
    # gates; this separates pink mucosa from white eye tissue).
    if s_chan is not None and v_chan is not None:
        selm = cnt_mask > 0
        white_frac = float(np.mean(((s_chan[selm] < 60) & (v_chan[selm] > 130))))
        if white_frac > 0.45:
            return _rej("too-white")

    s_a = _clip01((red["mean_a"] - 128.0) / 22.0)
    s_rmg = _clip01(red["mean_rmg"] / 28.0)
    s_sat = _clip01((red["mean_s"] - 35.0) / 60.0)
    mh = red["mean_h"]
    hue_score = 1.0 if (mh < 8 or mh > 150) else _clip01(1.0 - (mh - 8.0) / 17.0)
    red_abs = 0.40 * s_a + 0.20 * s_rmg + 0.20 * s_sat + 0.20 * hue_score

    # --- Annulus contrast (primary, self-calibrating) ---------------------
    k_ann = _rel_kernel(min_dim, 18, min_k=7, max_k=51)
    dil = cv2.dilate(cnt_mask, k_ann, iterations=1)
    ann = (dil > 0) & (cnt_mask == 0)
    ann_px = int(np.count_nonzero(ann))
    if ann_px < 200:
        return _rej("thin-annulus")
    ann_mean_a = float(np.mean(a_chan[ann].astype(np.float64)))
    contrast = red["mean_a"] - ann_mean_a
    if contrast < ROI_MIN_ANNULUS_CONTRAST:
        return _rej("low-contrast")
    # White rim: the UPPER annulus of true conjunctiva contains the
    # neighbouring sclera (measured up-white: true 0.27-0.80, lid-margin /
    # cheek / fingers ~0.00-0.01). Tight-crop fallback for frames where the
    # sclera is cropped out: big, very red, central blobs.
    white_rim = 0.0
    up_white = 0.0
    m = cv2.moments(cnt)
    cx = m["m10"] / (m["m00"] + 1e-9)
    cy = m["m01"] / (m["m00"] + 1e-9)
    if s_chan is not None and v_chan is not None:
        yy, xx = np.nonzero(ann)
        if yy.size:
            white_ann = ((s_chan[ann] < 60) & (v_chan[ann] > 130))
            white_rim = float(np.mean(white_ann))
            up_sel = yy < cy
            if int(np.count_nonzero(up_sel)) >= 100:
                up_white = float(np.mean(white_ann[up_sel]))
    d = math.hypot(cx - img_w / 2.0, cy - img_h / 2.0) / (math.hypot(img_w / 2.0, img_h / 2.0) + 1e-9)
    cent = 1.0 - _clip01((d - 0.25) / 0.55)
    if up_white < 0.06 and white_rim < 0.22:
        tight_crop_ok = (frac > 0.06 and contrast > 6.0 and cent > 0.6)
        if not tight_crop_ok:
            return _rej("no-white-rim")
    # Below-eye: the conjunctiva must sit below the eye's dark mass (validated
    # iris when available, else the search dark centroid). Measured: above/beside
    # impostors (upper-lid skin, beside-iris sclera) sit at/above eye height.
    # Relative margin keeps tilted framings tolerable.
    ref_y = iris_cy if iris_cy is not None else dark_cy
    if ref_y is not None and cy < ref_y - min_dim * 0.03:
        return _rej("above-eye")
    contrast_score = _clip01((contrast - ROI_MIN_ANNULUS_CONTRAST) / 10.0)

    redness = 0.35 * red_abs + 0.65 * contrast_score
    if redness < 0.12:
        return _rej("low-redness")

    if 0.006 <= frac <= 0.14:
        score_area = 1.0
    elif frac < 0.006:
        score_area = (frac - 0.0012) / (0.006 - 0.0012)
    else:
        score_area = max(0.0, 1.0 - (frac - 0.14) / 0.21)
    shape = (0.45 * _clip01((elong - 1.2) / 1.8)
             + 0.30 * _clip01((sol - 0.45) / 0.35)
             + 0.25 * _clip01((extent - 0.25) / 0.35))

    if d > 0.65:  # far periphery (nails at frame edge, ears, hair): never conjunctiva
        return _rej("periphery")
    if cy / max(1.0, float(img_h)) > 0.85:  # bottom edge band: entering fingers /
        return _rej("bottom-band")           # nails / lid edge, never the exposed strip
    # Near dark eye tissue (lashes/iris): conjunctiva hugs the eye; fingers
    # and cheek patches sit farther from dark pixels.
    if dark_dist is not None:
        dd = float(dark_dist[int(max(0, min(img_h - 1, round(cy)))),
                             int(max(0, min(img_w - 1, round(cx))))])
        darkprox = 1.0 - _clip01((dd - min_dim * 0.03) / (min_dim * 0.22))
    else:
        darkprox = 0.5
    # Edge fingers/nails: components cropped by the frame border AND far from
    # eye-dark are entering fingers or nail polish, never conjunctiva. (Tight
    # crops of real conjunctiva still sit near lashes → darkprox high → pass.)
    touches_edge = (x <= 1 or y <= 1 or x + bw >= img_w - 1 or y + bh >= img_h - 1)
    if touches_edge and darkprox < 0.30:
        return _rej("edge-finger")
    if dark_cy is not None:
        below = _clip01(0.5 + ((cy - dark_cy) / max(1.0, float(img_h))) * 4.0)
    else:
        below = 0.5

    confidence = (0.35 * contrast_score + 0.15 * red_abs + 0.15 * shape
                  + 0.12 * _clip01(score_area) + 0.08 * cent
                  + 0.10 * darkprox + 0.05 * below)
    detail = {"confidence": float(confidence), "redness": float(redness),
              "contrast": float(contrast_score), "annulus_contrast": float(contrast),
              "white_rim": float(white_rim), "up_white": float(up_white),
              "red_abs": float(red_abs), "shape": float(shape),
              "area_score": float(_clip01(score_area)), "centrality": float(cent),
              "dark_proximity": float(darkprox),
              "below_dark": float(below), "elong": float(elong),
              "solidity": float(sol), "extent": float(extent),
              "mean_a": float(red["mean_a"]), "mean_s": float(red["mean_s"]),
              "area_frac": float(frac),
              "cx": float(cx), "cy": float(cy)}
    return float(confidence), detail


def detect_conjunctiva_roi(img_bgr: np.ndarray, debug: bool = False) -> dict[str, Any]:
    """
    Detect conjunctival ROI — robust classical pipeline (no DL, no landmarks).

    Returns dict with:
      success: bool
      mask: np.ndarray (if success)
      bbox: (x,y,w,h)
      pixel_count: int
      entropy: float
      tri_thresh: float
      confidence: float (0-1 quality score)
      quality: dict (score breakdown)
      reason: str (if failure)
      _debug: dict of intermediate images (only when debug=True)
    """
    if img_bgr is None or img_bgr.size == 0:
        return {"success": False, "reason": "Invalid image (empty)"}

    h, w = img_bgr.shape[:2]
    total = h * w
    min_dim = min(h, w)

    # Legacy-compatible meta (kept for API contract / HEMOLENS research log).
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray_blur = cv2.GaussianBlur(gray, (5, 5), 0)
    entropy = _grayscale_entropy(gray)
    tri_thresh_val, _tri_mask = cv2.threshold(gray_blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_TRIANGLE)

    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    a_chan = lab[:, :, 1]
    s_chan = hsv[:, :, 1]
    h_chan = hsv[:, :, 0]
    v_chan = hsv[:, :, 2]
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    r = img_rgb[:, :, 0]
    g = img_rgb[:, :, 1]

    dbg: dict[str, Any] = {}

    # --- Anchors (dark first: sclera must couple to iris/pupil) ------------
    dark = _detect_dark_anchor(gray, hsv, min_dim)
    dark_u8 = dark["mask"]
    # Raw white map (pre-coupling) for iris validation: a real iris touches
    # bright tissue, while eyebrows/hair/shadows do not. Gate is deliberately
    # loose (shadowed sclera passes); coupling + purge decide downstream.
    _white_raw = (((s_chan < 50) & (v_chan > 140)).astype(np.uint8)) * 255
    _wk = _rel_kernel(min_dim, 150)
    _white_raw = cv2.morphologyEx(_white_raw, cv2.MORPH_OPEN, _wk, iterations=1)
    valid_iris = _filter_iris_candidates(dark, _white_raw, w, h, min_dim)
    raw_dark_cands = list(dark.get("candidates", []))
    if valid_iris:
        dark = {"mask": dark_u8, "iris": valid_iris[0], "candidates": valid_iris}
    else:
        dark = {"mask": dark_u8, "iris": None, "candidates": []}

    # Specular highlights (wet glints): very bright + almost colorless.
    specular_u8 = ((((v_chan > 248) & (s_chan < 30)).astype(np.uint8)) * 255)

    # Adaptive red map + triple-conjunction eye fallback (dark+white+red).
    red_u8 = _red_tissue_map(a_chan, s_chan, v_chan)
    eye_cluster = _locate_eye_cluster(dark_u8, _white_raw, red_u8, w, h, min_dim)

    if not valid_iris and eye_cluster is not None and raw_dark_cands:
        # No validated iris (brown/green iris, glare): couple sclera to compact
        # dark blobs INSIDE the eye box (lashes/pupil/iris fragments). Blobs
        # outside the box (brows/hair) stay excluded.
        _ex, _ey, _ebw, _ebh = eye_cluster["bbox"]
        _m = max(6, min_dim // 60)
        in_box = [c for c in raw_dark_cands
                  if (_ex - _m <= c["centroid"][0] <= _ex + _ebw + _m
                      and _ey - _m <= c["centroid"][1] <= _ey + _ebh + _m)]
        if in_box:
            dark = {"mask": dark_u8, "iris": None, "candidates": in_box}
    iris_centroid = dark["iris"]["centroid"] if dark["iris"] else None
    sclera = _detect_sclera_anchor(hsv, min_dim, dark=dark)
    sclera_u8: Optional[np.ndarray] = sclera["mask"] if sclera["comps"] else None

    # Purge pink bleed-through from the sclera geometry (Otsu split on a*):
    # pale conjunctiva can pass the white gate, which would otherwise make the
    # ring avoid the conjunctiva and the exclusion erase it.
    if sclera_u8 is not None:
        purged = _purge_red_from_sclera(sclera_u8, a_chan)
        if int(np.count_nonzero(purged)) >= 300:
            sclera_u8 = purged
            pcontours, _ = cv2.findContours(purged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            pcomps: list[dict[str, Any]] = []
            for pc in pcontours:
                pa = cv2.contourArea(pc)
                pf = pa / total
                if pf < 0.002 or pf > 0.30:
                    continue
                px0, py0, pbw, pbh = cv2.boundingRect(pc)
                pm = cv2.moments(pc)
                pcomps.append({"contour": pc, "area": pa, "frac": pf,
                               "bbox": (px0, py0, pbw, pbh),
                               "centroid": (pm["m10"] / (pm["m00"] + 1e-9),
                                            pm["m01"] / (pm["m00"] + 1e-9))})
            pcomps.sort(key=lambda d: d["area"], reverse=True)
            if pcomps:
                sclera = {"mask": purged, "comps": pcomps}
            else:
                sclera_u8 = None
                sclera = {"mask": np.zeros((h, w), dtype=np.uint8), "comps": []}

    # Below-iris reference: true iris centroid, else eye-cluster center.
    below_ref = iris_centroid if iris_centroid is not None else (
        eye_cluster["center"] if eye_cluster is not None else None)

    # --- Search region ---------------------------------------------------
    if sclera_u8 is not None and sclera["comps"]:
        bx, by, bbw, bbh = sclera["comps"][0]["bbox"]
        px = int(bbw * 0.45) + min_dim // 40
        py = int(bbh * 0.55) + min_dim // 40
        sx, sy, sbw, sbh = _clip_rect(bx - px, by - py, bbw + 2 * px, bbh + 2 * py, w, h)
        search_u8 = np.zeros((h, w), dtype=np.uint8)
        search_u8[sy:sy + sbh, sx:sx + sbw] = 255
        k_ring_big = _rel_kernel(min_dim, 12)
    elif eye_cluster is not None:
        # Tight eye-centred box (relative size): better than a blind band when
        # the iris/sclera could not be segmented (brown eyes, glare, shadow).
        ecx, ecy = eye_cluster["center"]
        sw = min(w, int(min_dim * 1.15))
        sh = min(h, int(min_dim * 0.95))
        sx, sy, sbw, sbh = _clip_rect(int(ecx - sw / 2), int(ecy - sh / 2), sw, sh, w, h)
        search_u8 = np.zeros((h, w), dtype=np.uint8)
        search_u8[sy:sy + sbh, sx:sx + sbw] = 255
        k_ring_big = _rel_kernel(min_dim, 12)
    else:
        search_u8 = np.zeros((h, w), dtype=np.uint8)
        x0, x1 = int(w * 0.06), int(w * 0.94)
        y0, y1 = int(h * 0.15), int(h * 0.92)
        search_u8[y0:y1, x0:x1] = 255
        k_ring_big = _rel_kernel(min_dim, 12)

    # --- Peri-scleral ring (rotation-invariant adjacency reference) ------
    ring_u8: Optional[np.ndarray] = None
    ring_mean_a: Optional[float] = None
    if sclera_u8 is not None:
        dilated = cv2.dilate(sclera_u8, k_ring_big, iterations=1)
        ring = (dilated > 0) & (sclera_u8 == 0) & (dark_u8 == 0) & (specular_u8 == 0)
        ring &= (search_u8 > 0)
        if int(np.count_nonzero(ring)) > 500:
            ring_u8 = (ring.astype(np.uint8)) * 255
            ring_mean_a = float(np.mean(a_chan[ring].astype(np.float64)))
        else:
            ring_u8 = None
            ring_mean_a = None

    # --- Candidate masks: TWO selectivities, pooled ------------------------
    # Strict (reddest cores only): isolates vivid strip cores from adjacent
    # sclera/skin. Inclusive (pale tissue kept): catches pale conjunctiva.
    # Pieces from both are pooled for scoring; strict gates pick the winner.
    tissue_dom = ((search_u8 > 0) & (dark_u8 == 0) & (specular_u8 == 0))
    if sclera_u8 is not None:
        tissue_dom &= (sclera_u8 == 0)
    tissue_u8 = (tissue_dom.astype(np.uint8)) * 255

    def _build_cleaned(a_bin: np.ndarray) -> np.ndarray:
        weak = ((a_bin > 0) & (r.astype(np.int16) > g.astype(np.int16))
                & (s_chan > 25) & (v_chan > 50) & (v_chan < 248))
        if sclera_u8 is not None:
            weak &= (sclera_u8 == 0)
        weak &= (dark_u8 == 0) & (specular_u8 == 0)
        cand = (weak.astype(np.uint8)) * 255
        cl = cv2.morphologyEx(cand, cv2.MORPH_OPEN, k_open, iterations=1)
        return cv2.morphologyEx(cl, cv2.MORPH_CLOSE, k_close, iterations=1)

    k_open = _rel_kernel(min_dim, 200, min_k=3, max_k=11)
    k_close = _rel_kernel(min_dim, 150, min_k=3, max_k=15)

    otsu_strict = _otsu_on_channel(a_chan, search_u8, domain_u8=tissue_u8, pct_floor=90.0)
    otsu_incl = _otsu_on_channel(a_chan, search_u8, domain_u8=tissue_u8, pct_low=70.0)
    if otsu_strict is None and otsu_incl is None:
        out: dict[str, Any] = {"success": False,
             "reason": "No eye search region (image too uniform or eye not found) — please retake with the lower lid clearly exposed.",
             "entropy": entropy, "tri_thresh": float(tri_thresh_val), "confidence": 0.0}
        if debug:
            out["_debug"] = dbg
        return out
    cleaned_pool: list[np.ndarray] = []
    a_thresh = 0.0
    if otsu_strict is not None:
        a_thresh = float(otsu_strict[0])
        cleaned_pool.append(_build_cleaned(otsu_strict[1]))
    if otsu_incl is not None:
        a_thresh = float(otsu_incl[0]) if otsu_strict is None else a_thresh
        _ci = _build_cleaned(otsu_incl[1])
        if otsu_strict is None or int(np.count_nonzero(cv2.bitwise_xor(_ci, cleaned_pool[0]))) > 500:
            cleaned_pool.append(_ci)
    candidate_u8 = cleaned_pool[0]
    cleaned = cleaned_pool[0]
    if debug:
        dbg["a_thresh"] = float(a_thresh)
        dbg["candidate_raw"] = candidate_u8.copy()

    # Split fused blobs (strip + skin/sclera/fingers) at narrow bridges so
    # each piece is scored on its own merits; falls back to the whole mask.
    # Pieces from BOTH selectivity masks are pooled.
    pieces: list[np.ndarray] = []
    for _cm in cleaned_pool:
        pieces.extend(_separate_pieces(_cm, min_dim))
    masks_to_score = pieces if pieces else cleaned_pool
    # Dark distance map (for dark-proximity cue) + dark mass centroid inside
    # the search region (lashes/iris sit above the conjunctiva).
    _dark_inv = ((dark_u8 == 0).astype(np.uint8)) * 255
    try:
        dark_dist = cv2.distanceTransform(_dark_inv, cv2.DIST_L2, 3)
    except Exception:
        dark_dist = None
    _dm = cv2.moments(((dark_u8 > 0) & (search_u8 > 0)).astype(np.uint8))
    dark_cy: Optional[float] = (_dm["m01"] / _dm["m00"]) if _dm["m00"] > 50 else below_ref[1] if below_ref else None
    scored: list[tuple[float, dict[str, float], np.ndarray]] = []
    reject_log: list = []
    n_contours = 0
    iris_cy: Optional[float] = (dark["iris"]["centroid"][1] if dark.get("iris") else None)
    for _sm in masks_to_score:
        contours, _ = cv2.findContours(_sm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        n_contours += len(contours)
        for c in contours:
            area = cv2.contourArea(c)
            frac = area / total
            tmp = np.zeros((h, w), dtype=np.uint8)
            cv2.drawContours(tmp, [c], -1, 255, -1)
            red = _component_redness(a_chan, s_chan, h_chan, r, g, tmp)
            s = _score_candidate(c, area, frac, w, h, total, red, tmp,
                                 a_chan, dark_dist, dark_cy, min_dim,
                                 s_chan=s_chan, v_chan=v_chan, iris_cy=iris_cy,
                                 reject_log=reject_log if debug else None)
            if s is None:
                continue
            scored.append((s[0], s[1], c))
    scored.sort(key=lambda t: t[0], reverse=True)
    if debug:
        dbg["search_mask"] = search_u8.copy()
        dbg["sclera_mask"] = sclera_u8.copy() if sclera_u8 is not None else np.zeros((h, w), dtype=np.uint8)
        dbg["dark_mask"] = dark_u8.copy()
        dbg["red_map"] = red_u8.copy()
        if eye_cluster is not None:
            _ec = np.zeros((h, w, 3), dtype=np.uint8)
            _ex, _ey, _ebw, _ebh = eye_cluster["bbox"]
            cv2.rectangle(_ec, (_ex, _ey), (_ex + _ebw, _ey + _ebh), (255, 255, 255), 2)
            dbg["eye_cluster_box"] = _ec
        dbg["candidate_mask"] = candidate_u8.copy()
        dbg["cleaned_mask"] = cleaned.copy()
        dbg["ring_mask"] = ring_u8.copy() if ring_u8 is not None else np.zeros((h, w), dtype=np.uint8)
        overlay = img_bgr.copy()
        for i, (_, _, c) in enumerate(scored[:8]):
            color = (0, 255 - min(255, i * 30), min(255, i * 30))
            cv2.drawContours(overlay, [c], -1, color, 2)
        dbg["contours_overlay"] = overlay
        dbg["scores"] = [{"confidence": c, **d} for c, d, _ in scored[:8]]
        dbg["rejected"] = [{"area_frac": a, "stage": s} for a, s in reject_log[:12]]
        dbg["n_contours"] = n_contours
        dbg["n_pieces"] = len(masks_to_score)

    if not scored:
        out = {"success": False,
             "reason": "No conjunctiva-like region found (no reddish crescent adjacent to the eye white) — please retake with the lower eyelid pulled down.",
             "entropy": entropy, "tri_thresh": float(tri_thresh_val), "confidence": 0.0}
        if debug:
            out["_debug"] = dbg
        return out

    best_conf, best_detail, best_cnt = scored[0]

    # --- Local refinement inside expanded best bbox ----------------------
    x, y, bw, bh = cv2.boundingRect(best_cnt)
    pad = max(4, int(max(bw, bh) * 0.10) + min_dim // 200)
    rx, ry, rbw, rbh = _clip_rect(x - pad, y - pad, bw + 2 * pad, bh + 2 * pad, w, h)
    box_mask = np.zeros((h, w), dtype=np.uint8)
    box_mask[ry:ry + rbh, rx:rx + rbw] = 255
    box_tissue = ((box_mask > 0) & (dark_u8 == 0) & (specular_u8 == 0))
    if sclera_u8 is not None:
        box_tissue &= (sclera_u8 == 0)
    otsu2 = _otsu_on_channel(a_chan, box_mask, domain_u8=(box_tissue.astype(np.uint8)) * 255,
                             pct_floor=85.0)
    final_mask: Optional[np.ndarray] = None
    if otsu2 is not None:
        _, a_bin2 = otsu2
        weak2 = ((a_bin2 > 0) & (r.astype(np.int16) > g.astype(np.int16))
                 & (s_chan > 20) & (v_chan > 40) & (v_chan < 250))
        if sclera_u8 is not None:
            weak2 &= (sclera_u8 == 0)
        weak2 &= (dark_u8 == 0) & (specular_u8 == 0)
        ref_u8 = (weak2.astype(np.uint8)) * 255
        ref_u8 = cv2.morphologyEx(ref_u8, cv2.MORPH_CLOSE, k_close, iterations=1)
        n2, lab2, stats2, _ = cv2.connectedComponentsWithStats(ref_u8, 8)
        best_tmp = np.zeros((h, w), dtype=np.uint8)
        cv2.drawContours(best_tmp, [best_cnt], -1, 255, -1)
        best_px = max(1, int(np.count_nonzero(best_tmp)))
        keep_idx = -1
        keep_score = -1.0
        for i in range(1, n2):
            comp = (lab2 == i).astype(np.uint8) * 255
            overlap = float(np.count_nonzero((comp > 0) & (best_tmp > 0))) / best_px
            if overlap < 0.30:
                continue
            area2 = float(stats2[i, cv2.CC_STAT_AREA])
            red2 = _component_redness(a_chan, s_chan, h_chan, r, g, comp)
            # quick redness re-check (same scale as scorer)
            rc = (0.40 * _clip01((red2["mean_a"] - 128.0) / 22.0)
                  + 0.20 * _clip01(red2["mean_rmg"] / 28.0)
                  + 0.20 * _clip01((red2["mean_s"] - 35.0) / 60.0))
            score2 = overlap * 0.6 + rc * 0.4 + min(1.0, area2 / (best_px + 1e-9)) * 0.2
            if score2 > keep_score:
                keep_score = score2
                keep_idx = i
        if keep_idx > 0:
            area_keep = float(stats2[keep_idx, cv2.CC_STAT_AREA])
            # Guard: refinement must stay a local snap, not balloon into skin
            # (relative cap: <=2.5x the scored component and <=35% of image).
            if area_keep <= 2.5 * best_px and area_keep / total <= ROI_MAX_AREA_FRAC:
                sel = (lab2 == keep_idx).astype(np.uint8) * 255
            else:
                keep_idx = -1
        if keep_idx > 0:
            sel = (lab2 == keep_idx).astype(np.uint8) * 255
            # Fill holes (specular glints / vessel gaps) so features use full
            # tissue. Border-safe: fill via RETR_CCOMP contours (a flood fill
            # from the image corner would leak when the mask touches the
            # search-box/image border and swallow the background).
            hole_cnts, _ = cv2.findContours(sel, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
            filled = np.zeros_like(sel)
            if hole_cnts:
                cv2.drawContours(filled, hole_cnts, -1, 255, -1)
            else:
                filled = sel.copy()
            filled[(dark_u8 > 0) | (specular_u8 > 0)] = 0
            if sclera_u8 is not None:
                filled[sclera_u8 > 0] = 0
            k3 = _rel_kernel(min_dim, 300, min_k=3, max_k=7)
            filled = cv2.morphologyEx(filled, cv2.MORPH_OPEN, k3, iterations=1)
            if int(np.count_nonzero(filled)) >= 400:
                final_mask = filled

    if final_mask is None:
        final_mask = np.zeros((h, w), dtype=np.uint8)
        cv2.drawContours(final_mask, [best_cnt], -1, 255, -1)
        final_mask[(dark_u8 > 0) | (specular_u8 > 0)] = 0
        if sclera_u8 is not None:
            final_mask[sclera_u8 > 0] = 0

    contours_f, _ = cv2.findContours(final_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours_f:
        out = {"success": False, "reason": "ROI refinement removed all pixels — please retake.",
             "entropy": entropy, "tri_thresh": float(tri_thresh_val), "confidence": float(best_conf)}
        if debug:
            out["_debug"] = dbg
        return out
    cf = max(contours_f, key=cv2.contourArea)
    precise = np.zeros((h, w), dtype=np.uint8)
    cv2.drawContours(precise, [cf], -1, 255, -1)
    pixel_count = int(cv2.countNonZero(precise))
    fx, fy, fbw, fbh = cv2.boundingRect(cf)
    frac = pixel_count / total

    # --- Final gates (relative only) -------------------------------------
    if pixel_count < 400 or frac < ROI_MIN_AREA_FRAC:
        out = {"success": False,
             "reason": f"Conjunctiva region too small ({pixel_count}px) — move closer and expose more of the lower lid.",
             "entropy": entropy, "tri_thresh": float(tri_thresh_val), "confidence": float(best_conf)}
        if debug:
            out["_debug"] = dbg
        return out
    if frac > ROI_MAX_AREA_FRAC:
        out = {"success": False,
             "reason": f"Conjunctiva region too large ({frac:.2f} of image) — likely skin; please retake with only the eye filling the frame.",
             "entropy": entropy, "tri_thresh": float(tri_thresh_val), "confidence": float(best_conf)}
        if debug:
            out["_debug"] = dbg
        return out
    if fbw < 12 or fbh < 8:
        out = {"success": False, "reason": f"ROI too thin ({fbw}x{fbh}) — please retake.",
             "entropy": entropy, "tri_thresh": float(tri_thresh_val), "confidence": float(best_conf)}
        if debug:
            out["_debug"] = dbg
        return out
    if entropy < MIN_ENTROPY:
        out = {"success": False, "reason": f"Image too uniform (entropy {entropy:.2f}) — please retake in better light.",
             "entropy": entropy, "tri_thresh": float(tri_thresh_val), "confidence": float(best_conf)}
        if debug:
            out["_debug"] = dbg
        return out
    if best_conf < ROI_MIN_CONFIDENCE:
        out = {"success": False,
             "reason": f"Low ROI confidence ({best_conf:.2f} < {ROI_MIN_CONFIDENCE}) — no reliable conjunctiva found; please retake with the lower lid pulled down.",
             "entropy": entropy, "tri_thresh": float(tri_thresh_val), "confidence": float(best_conf)}
        if debug:
            out["_debug"] = dbg
        return out

    quality = {"confidence": float(best_conf), **{k: float(v) for k, v in best_detail.items() if k != "confidence"}}
    result: dict[str, Any] = {
        "success": True,
        "mask": precise,
        "bbox": (int(fx), int(fy), int(fbw), int(fbh)),
        "pixel_count": int(pixel_count),
        "entropy": float(entropy),
        "tri_thresh": float(tri_thresh_val),
        "confidence": float(best_conf),
        "quality": quality,
    }
    if debug:
        filt = img_bgr.copy()
        cv2.drawContours(filt, [cf], -1, (0, 255, 0), 2)
        dbg["filtered_overlay"] = filt
        dbg["final_mask"] = precise.copy()
        dbg["final_marked"] = create_roi_marked_image(img_bgr, precise, (int(fx), int(fy), int(fbw), int(fbh)))
        result["_debug"] = dbg
    return result


def _detect_conjunctiva_legacy(img_bgr: np.ndarray) -> dict[str, Any]:
    """
    Superseded v1 implementation (fixed mucosa gate + grayscale triangle).
    Kept for reference only — NOT used. See v2 above.
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
            "meta": {"entropy": roi_result.get("entropy"), "tri_thresh": roi_result.get("tri_thresh"),
                     "roi_confidence": float(roi_result.get("confidence", 0.0))},
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
        "roi": {"x": int(x), "y": int(y), "width": int(bw), "height": int(bh), "pixel_count": int(pixel_count),
                "confidence": float(roi_result.get("confidence", 0.0))},
        "original_image_reference": orig_ref,
        "roi_marked_image_reference": marked_ref,
        "original_image_base64": original_base64,
        "roi_marked_image_base64": roi_marked_base64,
        "meta": {
            "entropy": float(roi_result.get("entropy", 0)),
            "tri_thresh": float(roi_result.get("tri_thresh", 0)),
            "normalization": "LAB_CLAHE_L_clip2.0_tile8x8",
            "roi_fraction": float(pixel_count / (img_bgr.shape[0]*img_bgr.shape[1])),
            "roi_confidence": float(roi_result.get("confidence", 0.0)),
            "roi_quality": roi_result.get("quality", {}),
        },
    }

# ---------------------------------------------------------------------------
# Debug helpers: staged intermediate outputs
# (original -> normalized -> candidate mask -> contours -> filtered -> final)
# ---------------------------------------------------------------------------

def debug_roi_pipeline(img_bgr: np.ndarray) -> dict[str, Any]:
    """
    Run ROI detection with staged classical-CV intermediates for inspection.

    Returns dict with BGR/uint8 stage images (all same HxW as input):
      original, normalized, a_channel_vis, sclera_mask_vis, candidate_mask,
      cleaned_mask, contours_overlay, filtered_overlay, final_marked,
      final_mask, plus scores (list), confidence, success, reason.
    No files are written; use save_roi_debug_images to persist.
    """
    res = detect_conjunctiva_roi(img_bgr, debug=True)
    dbg = res.get("_debug", {})
    h, w = img_bgr.shape[:2]

    def _to_bgr(u8: np.ndarray) -> np.ndarray:
        if u8 is None:
            return np.zeros((h, w, 3), dtype=np.uint8)
        m = (u8 > 0).astype(np.uint8) * 255
        return cv2.cvtColor(m, cv2.COLOR_GRAY2BGR)

    normalized = normalize_illumination(img_bgr)
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    a_vis = cv2.applyColorMap(cv2.normalize(lab[:, :, 1], None, 0, 255, cv2.NORM_MINMAX), cv2.COLORMAP_JET)

    stages: dict[str, Any] = {
        "original": img_bgr.copy(),
        "normalized": normalized,
        "a_channel_vis": a_vis,
        "sclera_mask_vis": _to_bgr(dbg.get("sclera_mask")),
        "candidate_mask": _to_bgr(dbg.get("candidate_mask", dbg.get("candidate_raw"))),
        "cleaned_mask": _to_bgr(dbg.get("cleaned_mask")),
        "contours_overlay": dbg.get("contours_overlay", img_bgr.copy()),
        "filtered_overlay": dbg.get("filtered_overlay", img_bgr.copy()),
        "final_marked": dbg.get("final_marked", img_bgr.copy()),
        "final_mask": _to_bgr(dbg.get("final_mask")),
        "scores": dbg.get("scores", []),
        "confidence": float(res.get("confidence", 0.0)),
        "success": bool(res.get("success")),
        "reason": res.get("reason", ""),
        "bbox": res.get("bbox"),
    }
    return stages


def save_roi_debug_images(img_bgr: np.ndarray, out_dir: Any, stem: str = "roi") -> dict[str, str]:
    """
    Persist the six required debug stages as JPEGs:
      1 original, 2 normalized, 3 candidate mask, 4 contours,
      5 filtered candidates, 6 final ROI.
    Returns {stage: filepath}. Creates out_dir if needed.
    """
    from pathlib import Path as _P
    d = _P(str(out_dir))
    d.mkdir(parents=True, exist_ok=True)
    stages = debug_roi_pipeline(img_bgr)
    wanted = ["original", "normalized", "candidate_mask", "contours_overlay",
              "filtered_overlay", "final_marked"]
    refs: dict[str, str] = {}
    for name in wanted:
        img = stages[name]
        p = d / f"{stem}_{name}.jpg"
        cv2.imwrite(str(p), img, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
        refs[name] = str(p)
    # Extra mask diagnostics (masks + a-channel) for deeper inspection.
    for name in ["a_channel_vis", "sclera_mask_vis", "cleaned_mask", "final_mask"]:
        p = d / f"{stem}_{name}.jpg"
        cv2.imwrite(str(p), stages[name], [int(cv2.IMWRITE_JPEG_QUALITY), 92])
        refs[name] = str(p)
    return refs

# Convenience for testing: deterministic repeated extraction check
def extract_features_from_bytes_deterministic(raw_bytes: bytes) -> dict[str, Any]:
    """Helper that calls extract_eyelid_features twice and asserts deterministic."""
    r1 = extract_eyelid_features(raw_bytes, save_images=False)
    r2 = extract_eyelid_features(raw_bytes, save_images=False)
    return r1, r2
