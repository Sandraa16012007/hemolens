"""
HemoLens — Nail-bed / Fingernail ROI Feature Extraction
========================================================
Deterministic handcrafted RGB optical feature extraction for fingernail
plate ROIs. Dedicated nail counterpart to `backend/cv/eyelid_features.py`.

Research basis (RGB nail-image methodology):
- Clearly visible, undamaged, uncoated nail plates; bounding boxes
  containing the complete nail plate, with the central 60% region used
  for robust calculation (bbox crops can contain skin/background).
- White-reference normalization of RGB intensities to reduce illumination
  dependence; measurements kept inside the camera dynamic range, away
  from values near 0 and 255 (clipping/saturation corrupts optics).
- Percentile descriptors of the inner-region RGB distribution.
- Multi-finger robustness via aggregation (research used one finger for
  simplicity but noted averaging over fingers improves robustness).

This module MUST NOT implement Hb prediction, anemia classification,
Random Forest / XGBoost, or any neural plate-segmentation model.
It only extracts features. It MUST NOT modify the eyelid pipeline
(`eyelid_features.py`), the nail validation gate
(`routers/screen.py::validate_image_nail`), or the eyelid ML schema.
It uses an extractor-local MediaPipe HandLandmarker ONLY as a geometric
prior for nail ROI placement (fingertip-anchored search crops); the nail
plate segmentation itself stays deterministic OpenCV/numpy.

Pipeline implemented here:
  validated nail image bytes (already passed validate-image-nail)
  -> extractor-local hand-prioritized ROI detection
     (MediaPipe Hands fingertip crops + plate-likelihood segmentation;
      distal-plate fallback for fist close-ups where the palm detector
      cannot fire; legacy validator Top-Hat candidate reuse as last resort)
  -> per-nail plate mask (Otsu bright-plate segmentation in bbox)
  -> inner 60% x 60% analysis region (intersection with plate mask)
  -> white-reference illumination normalization (explicit fallback)
  -> saturation/clipping exclusion (pixels near 0/255)
  -> per-nail RGB percentile descriptors (7 x 3 = 21)
  -> median aggregation across valid nails (model-facing 21-vector)
  -> ROI-marked image (numbered bboxes + inner regions)

Allowed dependencies only: opencv-python-headless, numpy, mediapipe
(MediaPipe Tasks API used solely for the extractor-local HandLandmarker
geometric prior; no sklearn, no LLM.)

Conventions mirrored from `eyelid_features.py`:
- `FEATURE_NAMES` / `FEATURE_DIM` fixed ordered schema.
- `extract_nail_features(raw_bytes, screening_id, output_dir, save_images)`
  success/failure dict contract; never fabricates features.
- Original image preserved unchanged; separate ROI-marked copy.
- `backend/storage/nail_features/<uuid>/` local storage + base64 data URLs.
- All values finite, deterministic for identical input.

Color scaling documentation:
- Input image: BGR, uint8, 0-255 per channel.
- Features computed in RGB 0-255 space (BGR->RGB via cvtColor).
  R = rgb[:,:,0], G = rgb[:,:,1], B = rgb[:,:,2].
- Normalization (when a white reference is found) is a per-channel
  multiplicative scale toward mid-gray 128 (see
  `normalize_by_white_reference`); otherwise values pass through
  unchanged and the fallback is recorded in metadata.
"""

from __future__ import annotations

import base64
import logging
import math
import urllib.request
import uuid
from pathlib import Path
from typing import Any, Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants / Feature Names (ordered, fixed length = 21)
# ---------------------------------------------------------------------------

#: Schema version for the nail RGB percentile descriptors.
SCHEMA_VERSION: str = "nail_rgb_v1"

#: Percentile levels (research methodology: 5/15/25/50/75/85/95).
PERCENTILES: tuple[int, ...] = (5, 15, 25, 50, 75, 85, 95)
_PCT_SUFFIX: tuple[str, ...] = ("p05", "p15", "p25", "p50", "p75", "p85", "p95")

FEATURE_NAMES: list[str] = (
    [f"r_{s}" for s in _PCT_SUFFIX]
    + [f"g_{s}" for s in _PCT_SUFFIX]
    + [f"b_{s}" for s in _PCT_SUFFIX]
)

FEATURE_DIM: int = len(FEATURE_NAMES)  # 21

#: Fraction of bbox width/height kept for the inner analysis region.
INNER_FRACTION: float = 0.60

#: Minimum bbox size accepted at decode level (mirrors eyelid MIN_ROI_DIM).
MIN_ROI_DIM: int = 20
#: Minimum absolute bbox area accepted at decode level.
MIN_BBOX_PIXELS: int = 800
#: Minimum inner-region valid pixels required per nail.
MIN_INNER_PIXELS: int = 400
#: Minimum fraction of the inner rect that must be nail-plate pixels.
MIN_INNER_FRAC: float = 0.25
#: Minimum number of valid nails required for success.
MIN_VALID_NAILS: int = 1

#: Saturation/clipping guard: pixels with ANY channel at/below SAT_LOW or
#: at/above SAT_HIGH are excluded from optical statistics (camera dynamic
#: range guard; research kept regions away from values near 0 and 255).
SAT_LOW: int = 8
SAT_HIGH: int = 247

#: White-reference detection thresholds (near-neutral bright non-skin
#: background). See `_find_white_reference`.
WHITE_MIN_CHANNEL: int = 180
WHITE_MAX_SPREAD: int = 30
WHITE_MAX_SATURATION: int = 45
WHITE_MIN_VALUE: int = 180
WHITE_MIN_FRAC: float = 0.005  # largest white component must cover >= 0.5%

#: Aggregation strategy identifier (recorded in meta).
AGGREGATION_METHOD: str = "median_across_valid_nails"

# Storage for generated images (mirrors eyelid `storage/eyelid_features`).
_DEFAULT_STORAGE_DIR = Path(__file__).parent.parent / "storage" / "nail_features"

# ---------------------------------------------------------------------------
# MediaPipe HandLandmarker — extractor-local geometric prior (never raises)
# ---------------------------------------------------------------------------
# Mirrors the FaceLandmarker singleton pattern in
# `backend/routers/screen.py` (download once into backend/models/, module
# singleton, _HAND_LANDMARKER_READY flag, graceful fallback). The landmarker
# is used ONLY to place fingertip-anchored search crops; plate segmentation
# inside each crop stays deterministic OpenCV/numpy.
_HAND_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
    "hand_landmarker/float16/1/hand_landmarker.task"
)
_HAND_MODEL_DIR = Path(__file__).parent.parent / "models"
_HAND_MODEL_PATH = _HAND_MODEL_DIR / "hand_landmarker.task"
_HAND_MAX_HANDS: int = 2
_HAND_MIN_DETECTION_CONFIDENCE: float = 0.3
_HAND_MIN_PRESENCE_CONFIDENCE: float = 0.3
_HAND_MIN_TRACKING_CONFIDENCE: float = 0.3


def _ensure_hand_model() -> Optional[Path]:
    """Download the HandLandmarker bundle once; None when unavailable."""
    try:
        _HAND_MODEL_DIR.mkdir(parents=True, exist_ok=True)
        if not _HAND_MODEL_PATH.exists():
            logger.info(
                "Downloading MediaPipe HandLandmarker model (~8 MB) to %s …",
                _HAND_MODEL_PATH,
            )
            urllib.request.urlretrieve(_HAND_MODEL_URL, _HAND_MODEL_PATH)
            logger.info("HandLandmarker model download complete.")
        return _HAND_MODEL_PATH
    except Exception as exc:
        logger.warning(f"HandLandmarker model unavailable: {exc}")
        return None


# Initialise hand landmarker once at import time (module-level singleton).
try:
    _hand_model_path = _ensure_hand_model()
    if _hand_model_path is None:
        raise RuntimeError("hand landmark model unavailable")
    import mediapipe as _mediapipe
    import mediapipe.tasks as _mp_tasks

    _hand_landmarker_options = _mp_tasks.vision.HandLandmarkerOptions(
        base_options=_mp_tasks.BaseOptions(
            model_asset_path=str(_hand_model_path)
        ),
        running_mode=_mp_tasks.vision.RunningMode.IMAGE,
        num_hands=_HAND_MAX_HANDS,
        min_hand_detection_confidence=_HAND_MIN_DETECTION_CONFIDENCE,
        min_hand_presence_confidence=_HAND_MIN_PRESENCE_CONFIDENCE,
        min_tracking_confidence=_HAND_MIN_TRACKING_CONFIDENCE,
    )
    _hand_landmarker = _mp_tasks.vision.HandLandmarker.create_from_options(
        _hand_landmarker_options
    )
    logger.info("MediaPipe HandLandmarker initialised successfully.")
    _HAND_LANDMARKER_READY = True
except Exception as _init_err:  # never raise — extractor falls back gracefully
    logger.warning(
        "MediaPipe HandLandmarker could not be initialised: %s. "
        "Nail ROI falls back to validator-reuse candidates.",
        _init_err,
    )
    _mediapipe = None  # type: ignore[no-redef]
    _hand_landmarker = None
    _HAND_LANDMARKER_READY = False

#: Per-finger (TIP, DIP/IP, MCP) landmark index triples. Thumb uses IP=3
#: as its distal joint; all other fingers use DIP (7/11/15/19).
_FINGER_JOINTS: tuple[tuple[int, int, int], ...] = (
    (4, 3, 2),  # thumb
    (8, 7, 5),  # index
    (12, 11, 9),  # middle
    (16, 15, 13),  # ring
    (20, 19, 17),  # pinky
)

#: Plate-likelihood priors shared by the crop segmenter (fraction of frame).
_PLATE_MIN_AREA_FRAC: float = 0.005  # 0.5% of frame
_PLATE_MAX_AREA_FRAC: float = 0.08  # 8% of frame
_PLATE_MIN_SOLIDITY: float = 0.7
#: Aspect gate for fingertip-crop segmentation (spec).
_PLATE_MIN_ASPECT: float = 0.6
_PLATE_MAX_ASPECT: float = 1.4
#: Slightly wider aspect gate for the no-hand distal fallback (fist
#: close-ups foreshorten plates; e.g. good2.png index nail is 0.56).
_DISTAL_MIN_ASPECT: float = 0.5
_DISTAL_MAX_ASPECT: float = 1.5
#: Distal location prior: nail-plate centres must lie at/after 40% of the
#: frame height (rejects knuckle-band / top-background highlights).
_DISTAL_MIN_CY_FRAC: float = 0.40
#: Row-consistency band: kept distal candidates must cluster within ±15%
#: of the frame height around their median centre-y (fingernails present
#: as a horizontal row; isolated highlights are rejected).
_DISTAL_ROW_BAND_FRAC: float = 0.15
#: Low-saturation + bright seed cue for nail plates (HSV).
_SEED_MAX_SAT: int = 70
_SEED_MIN_VAL: int = 150
#: Fingertip-crop gate: a finger is skipped unless at least this fraction
#: of its search crop holds low-saturation bright (plate-like) pixels.
#: Rejects crops placed on saturated skin by false-positive hand
#: detections (fist close-ups confuse the palm detector).
_FINGER_SEED_MIN_FRAC: float = 0.02
#: Finger-proportion gate: a fingertip-crop hit with either bbox side
#: longer than this multiple of the DIP-TIP length is rejected (nail
#: plates scale with the distal segment; larger bright blobs are palm /
#: background, e.g. beside a misplaced tip of a false-positive hand).
_FINGER_MAX_PLATE_SCALE: float = 1.8

# ---------------------------------------------------------------------------
# Helpers: decode / encode / storage (mirror eyelid conventions)
# ---------------------------------------------------------------------------


def _decode_image_bytes(raw_bytes: bytes) -> Optional[np.ndarray]:
    if not raw_bytes:
        return None
    arr = np.frombuffer(raw_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img  # BGR or None


def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def _encode_image_base64(img_bgr: np.ndarray) -> str:
    """Encode BGR image to base64 JPEG data URL (quality 95, as eyelid)."""
    success, buf = cv2.imencode(".jpg", img_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    if not success:
        return ""
    b64 = base64.b64encode(buf.tobytes()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def _save_images(
    original_bgr: np.ndarray,
    marked_bgr: np.ndarray,
    screening_id: Optional[str] = None,
    output_dir: Optional[Path] = None,
) -> tuple[str, str]:
    """Save original (unchanged) + ROI-marked copy. Returns (orig_ref, marked_ref)."""
    if output_dir is None:
        output_dir = _DEFAULT_STORAGE_DIR
    _ensure_dir(output_dir)
    sid = screening_id or uuid.uuid4().hex[:12]
    sub = output_dir / sid
    _ensure_dir(sub)
    orig_path = sub / "nail_original.jpg"
    marked_path = sub / "nail_roi_marked.jpg"
    cv2.imwrite(str(orig_path), original_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    cv2.imwrite(str(marked_path), marked_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    return str(orig_path), str(marked_path)


# ---------------------------------------------------------------------------
# ROI detection — reuse validated candidate geometry (no re-validation)
# ---------------------------------------------------------------------------


def _get_nail_candidates(img_bgr: np.ndarray) -> list[dict[str, Any]]:
    """
    Return validated nail candidate geometry.

    Reuses `routers/screen.py::_detect_nail_candidates` — the exact
    deterministic OpenCV stage backing `validate-image-nail` — so the
    extractor and the validation gate can never drift apart. No blur /
    brightness / resolution checks are re-run here; the caller guarantees
    the image already passed validation (a lightweight decode check is
    the only gate in this module).

    Falls back to an empty list (structured INVALID_ROI downstream) if the
    validator helper cannot be imported.
    """
    try:
        try:
            from backend.routers.screen import _detect_nail_candidates
        except ModuleNotFoundError:
            from routers.screen import _detect_nail_candidates  # type: ignore[no-redef]
        return list(_detect_nail_candidates(img_bgr))
    except Exception as exc:
        logger.debug(f"Nail candidate reuse unavailable: {exc}")
        return []


# ---------------------------------------------------------------------------
# Hand-prioritized candidates (extractor-local; legacy reuse is the fallback)
# ---------------------------------------------------------------------------


def _detect_hands(img_bgr: np.ndarray) -> list[Any]:
    """Run HandLandmarker (IMAGE mode); [] when unavailable or no hands."""
    if not _HAND_LANDMARKER_READY or _hand_landmarker is None or _mediapipe is None:
        return []
    try:
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        mp_image = _mediapipe.Image(
            image_format=_mediapipe.ImageFormat.SRGB, data=img_rgb
        )
        result = _hand_landmarker.detect(mp_image)
        return list(result.hand_landmarks or [])
    except Exception as exc:
        logger.debug(f"HandLandmarker detect failed: {exc}")
        return []


def _all_passing_components(
    bin_mask: np.ndarray,
    frame_total: int,
    min_aspect: float,
    max_aspect: float,
) -> list[dict[str, Any]]:
    """
    All connected components of `bin_mask` passing plate priors
    (size 0.5%-8% of frame, aspect gate, solidity > 0.7), largest-first.

    Deterministic: area-descending (ties keep label order). Each entry is
    a legacy-shaped candidate fragment with mask-local bbox/centre plus
    float `_cx`/`_cy` centroid helpers.
    """
    n, labels, stats, centroids = cv2.connectedComponentsWithStats(bin_mask, 8)
    order = sorted(
        range(1, n), key=lambda i: int(stats[i, cv2.CC_STAT_AREA]), reverse=True
    )
    out: list[dict[str, Any]] = []
    for i in order:
        area = int(stats[i, cv2.CC_STAT_AREA])
        if area < _PLATE_MIN_AREA_FRAC * frame_total:
            continue
        if area > _PLATE_MAX_AREA_FRAC * frame_total:
            continue
        x = int(stats[i, cv2.CC_STAT_LEFT])
        yy = int(stats[i, cv2.CC_STAT_TOP])
        bw = int(stats[i, cv2.CC_STAT_WIDTH])
        bh = int(stats[i, cv2.CC_STAT_HEIGHT])
        aspect = bw / (bh + 1e-6)
        if aspect < min_aspect or aspect > max_aspect:
            continue
        comp = ((labels == i).astype(np.uint8)) * 255
        cnts, _ = cv2.findContours(comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not cnts:
            continue
        best = max(cnts, key=cv2.contourArea)
        hull_area = cv2.contourArea(cv2.convexHull(best))
        solidity = float(cv2.contourArea(best) / (hull_area + 1e-6))
        if solidity <= _PLATE_MIN_SOLIDITY:
            continue
        cx, cy = float(centroids[i][0]), float(centroids[i][1])
        out.append({
            "bbox": (x, yy, bw, bh),
            "area": area,
            "area_frac": round(area / max(1, frame_total), 5),
            "aspect": round(aspect, 2),
            "solidity": round(solidity, 2),
            "center": (int(x + bw // 2), int(yy + bh // 2)),
            "_cx": cx,
            "_cy": cy,
        })
    return out


def _clean_3x3(bin_mask: np.ndarray) -> np.ndarray:
    """Morphological open then close with a 3x3 elliptical kernel."""
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    out = cv2.morphologyEx(bin_mask, cv2.MORPH_OPEN, k, iterations=1)
    return cv2.morphologyEx(out, cv2.MORPH_CLOSE, k, iterations=1)


def _crop_plate_masks(crop_bgr: np.ndarray) -> list[np.ndarray]:
    """
    Plate-likelihood binary masks for a search crop (OpenCV/numpy only):
    low-saturation bright seed -> CLAHE-L + Otsu (bright) ->
    CLAHE-L + adaptive-Gaussian (bright). Each cleaned open/close 3x3.
    Deterministic.
    """
    masks: list[np.ndarray] = []
    hsv = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2HSV)
    seed = (
        ((hsv[:, :, 1] < _SEED_MAX_SAT) & (hsv[:, :, 2] > _SEED_MIN_VAL))
        .astype(np.uint8)
        * 255
    )
    masks.append(_clean_3x3(seed))
    lab = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2LAB)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    lum = clahe.apply(lab[:, :, 0])
    _, otsu = cv2.threshold(lum, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    masks.append(_clean_3x3(otsu))
    ch, cw = lum.shape[:2]
    if min(ch, cw) >= 7:
        blk = min(31, (min(ch, cw) // 2) * 2 + 1)
        adap = cv2.adaptiveThreshold(
            lum, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, int(blk), 3,
        )
        masks.append(_clean_3x3(adap))
    return masks


def _plate_near_tip(
    crop_bgr: np.ndarray,
    frame_total: int,
    tip_local: tuple[float, float],
    max_dist: float,
) -> Optional[dict[str, Any]]:
    """
    Plate-likelihood segmentation inside a fingertip crop, anchored to the
    fingertip: for the first mask yielding any passing component
    (aspect 0.6-1.4 / solidity > 0.7 / size 0.5%-8% frame), keep components
    whose centroid lies within `max_dist` of the tip and return the nearest
    one (crop-local fragment) — shaft/palm blobs proximal to the tip are
    ignored. Deterministic; None when nothing qualifies.
    """
    try:
        tx, ty = tip_local
        for mask in _crop_plate_masks(crop_bgr):
            comps = _all_passing_components(
                mask, frame_total, _PLATE_MIN_ASPECT, _PLATE_MAX_ASPECT
            )
            near = [
                c for c in comps
                if float(np.hypot(c["_cx"] - tx, c["_cy"] - ty)) <= max_dist
            ]
            if near:
                near.sort(key=lambda c: float(np.hypot(c["_cx"] - tx, c["_cy"] - ty)))
                return near[0]
    except Exception as exc:
        logger.debug(f"Plate segmentation in crop failed: {exc}")
    return None


def _nms_like_legacy(cands: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Legacy-style NMS (centre distance < max(min(w,h),30)); area-desc."""
    ordered = sorted(
        cands,
        key=lambda c: (-int(c["area"]), int(c["bbox"][0]), int(c["bbox"][1])),
    )
    kept: list[dict[str, Any]] = []
    for cand in ordered:
        cx1, cy1 = cand["center"]
        x1, y1, w1, h1 = cand["bbox"]
        duplicate = False
        for prev in kept:
            cx2, cy2 = prev["center"]
            if float(np.hypot(cx1 - cx2, cy1 - cy2)) < max(min(w1, h1), 30):
                duplicate = True
                break
        if not duplicate:
            kept.append(cand)
    return kept


def _strip_internal(cand: dict[str, Any]) -> dict[str, Any]:
    """Drop underscore-prefixed helper keys; keep the legacy dict shape."""
    return {k: v for k, v in cand.items() if not k.startswith("_")}


def _candidates_from_hands(
    img_bgr: np.ndarray, hands: list[Any]
) -> list[dict[str, Any]]:
    """
    Per-finger search crops in the distal segment (DIP/IP -> TIP).

    For each finger the crop is centred slightly proximal to the tip
    (tip minus 0.35x the DIP-TIP length along the distal direction) with
    half-size 1.25x that length (clamped), then segmented with
    `_plate_near_tip` (nearest passing plate within 0.9x the DIP-TIP
    length of the tip). Full-image coordinates; legacy dict shape.
    """
    h, w = img_bgr.shape[:2]
    frame_total = h * w
    out: list[dict[str, Any]] = []
    for hand in hands:
        try:
            pts = [(float(lm.x) * w, float(lm.y) * h) for lm in hand]
        except Exception:
            continue
        for tip_i, dip_i, _mcp_i in _FINGER_JOINTS:
            if tip_i >= len(pts) or dip_i >= len(pts):
                continue
            tx, ty = pts[tip_i]
            dx, dy = pts[dip_i]
            vx, vy = tx - dx, ty - dy
            seg_len = float(np.hypot(vx, vy))
            if not np.isfinite(seg_len) or seg_len < 8.0:
                continue
            ux, uy = vx / seg_len, vy / seg_len
            ccx, ccy = tx - ux * 0.35 * seg_len, ty - uy * 0.35 * seg_len
            half = min(max(1.25 * seg_len, 20.0), 0.22 * max(w, h))
            x0 = max(0, int(round(ccx - half)))
            y0 = max(0, int(round(ccy - half)))
            x1 = min(w, int(round(ccx + half)))
            y1 = min(h, int(round(ccy + half)))
            if x1 - x0 < 20 or y1 - y0 < 20:
                continue
            crop = img_bgr[y0:y1, x0:x1]
            # Image-evidence gate: the fingertip must coincide with
            # plate-like pixels, else this finger's landmarks are bogus.
            try:
                crop_hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
                seed_frac = float(np.mean(
                    (crop_hsv[:, :, 1] < _SEED_MAX_SAT)
                    & (crop_hsv[:, :, 2] > _SEED_MIN_VAL)
                ))
            except Exception:
                continue
            if seed_frac < _FINGER_SEED_MIN_FRAC:
                continue
            hit = _plate_near_tip(
                crop, frame_total,
                (tx - x0, ty - y0), 0.9 * seg_len,
            )
            if hit is None:
                continue
            hx, hy, hbw, hbh = hit["bbox"]
            if max(hbw, hbh) > _FINGER_MAX_PLATE_SCALE * seg_len:
                continue
            out.append({
                "bbox": (x0 + hx, y0 + hy, hbw, hbh),
                "area": int(hit["area"]),
                "area_frac": round(int(hit["area"]) / max(1, frame_total), 5),
                "aspect": hit["aspect"],
                "solidity": hit["solidity"],
                "center": (x0 + hx + hbw // 2, y0 + hy + hbh // 2),
            })
    return _nms_like_legacy(out)


def _get_distal_plate_candidates(img_bgr: np.ndarray) -> list[dict[str, Any]]:
    """
    No-hand fallback for fist close-ups where the palm detector cannot
    fire (only fingertips visible, no wrist/palm context).

    Global low-saturation bright seed mask (open/close 3x3), then per
    interior component: size 0.5%-8% frame, aspect 0.5-1.5, solidity > 0.7,
    centre at/after 40% frame height, plus row-consistency (≥2 candidates
    clustered within ±15% frame height of their median centre-y, so an
    isolated knuckle/background highlight can never win on its own).
    Empty list → caller falls back to the legacy validator reuse.
    """
    try:
        h, w = img_bgr.shape[:2]
        frame_total = h * w
        hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
        seed = (
            ((hsv[:, :, 1] < _SEED_MAX_SAT) & (hsv[:, :, 2] > _SEED_MIN_VAL))
            .astype(np.uint8)
            * 255
        )
        mask = _clean_3x3(seed)
        n, labels, stats, centroids = cv2.connectedComponentsWithStats(mask, 8)
        passing: list[dict[str, Any]] = []
        for i in range(1, n):
            area = int(stats[i, cv2.CC_STAT_AREA])
            if area < _PLATE_MIN_AREA_FRAC * frame_total:
                continue
            if area > _PLATE_MAX_AREA_FRAC * frame_total:
                continue
            x = int(stats[i, cv2.CC_STAT_LEFT])
            yy = int(stats[i, cv2.CC_STAT_TOP])
            bw = int(stats[i, cv2.CC_STAT_WIDTH])
            bh = int(stats[i, cv2.CC_STAT_HEIGHT])
            if x <= 1 or yy <= 1 or x + bw >= w - 1 or yy + bh >= h - 1:
                continue  # border-touching: background, never a plate
            aspect = bw / (bh + 1e-6)
            if aspect < _DISTAL_MIN_ASPECT or aspect > _DISTAL_MAX_ASPECT:
                continue
            comp = ((labels == i).astype(np.uint8)) * 255
            cnts, _ = cv2.findContours(
                comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )
            if not cnts:
                continue
            best = max(cnts, key=cv2.contourArea)
            hull_area = cv2.contourArea(cv2.convexHull(best))
            solidity = float(cv2.contourArea(best) / (hull_area + 1e-6))
            if solidity <= _PLATE_MIN_SOLIDITY:
                continue
            cx, cy = float(centroids[i][0]), float(centroids[i][1])
            if cy < _DISTAL_MIN_CY_FRAC * h:
                continue
            passing.append({
                "bbox": (x, yy, bw, bh),
                "area": area,
                "area_frac": round(area / max(1, frame_total), 5),
                "aspect": round(aspect, 2),
                "solidity": round(solidity, 2),
                "center": (int(x + bw // 2), int(yy + bh // 2)),
                "_cy": cy,
            })
        if len(passing) < 2:
            return []
        cys = sorted(p["_cy"] for p in passing)
        median_cy = cys[len(cys) // 2]
        row = [
            p for p in passing
            if abs(p["_cy"] - median_cy) <= _DISTAL_ROW_BAND_FRAC * h
        ]
        if len(row) < 2:
            return []
        return [_strip_internal(c) for c in _nms_like_legacy(row)]
    except Exception as exc:
        logger.debug(f"Distal plate fallback failed: {exc}")
        return []


def _get_hand_prioritized_candidates(img_bgr: np.ndarray) -> list[dict[str, Any]]:
    """
    Extractor-local hand-prioritized nail candidates (legacy dict shape).

    1. MediaPipe HandLandmarker (IMAGE mode) fingertip-anchored crops.
    2. Distal-plate fallback for fist close-ups (no hand detected).
    3. [] → `extract_nail_features` falls back to legacy
       `_get_nail_candidates` validator reuse. Deterministic; never raises.
    """
    try:
        if img_bgr is None or getattr(img_bgr, "size", 0) == 0:
            return []
        hands = _detect_hands(img_bgr)
        if hands:
            hand_cands = _candidates_from_hands(img_bgr, hands)
            if hand_cands:
                logger.debug(f"Hand-prioritized candidates: {len(hand_cands)} "
                             f"from {len(hands)} hand(s).")
                return hand_cands
            logger.debug("Hands detected but no plates segmented in "
                         "fingertip crops; trying distal-plate fallback.")
        distal = _get_distal_plate_candidates(img_bgr)
        if distal:
            logger.debug(f"Distal-plate candidates: {len(distal)}.")
            return distal
        return []
    except Exception as exc:
        logger.debug(f"Hand-prioritized candidates unavailable: {exc}")
        return []


def _clip_bbox(
    bbox: tuple[int, int, int, int], w: int, h: int
) -> Optional[tuple[int, int, int, int]]:
    """Clip bbox to image bounds; reject degenerate boxes."""
    try:
        x, y, bw, bh = (int(v) for v in bbox)
    except Exception:
        return None
    x = max(0, x)
    y = max(0, y)
    bw = min(bw, w - x)
    bh = min(bh, h - y)
    if bw < MIN_ROI_DIM or bh < MIN_ROI_DIM:
        return None
    if bw * bh < MIN_BBOX_PIXELS:
        return None
    return (x, y, bw, bh)


def _nail_plate_mask(
    img_bgr: np.ndarray, bbox: tuple[int, int, int, int]
) -> tuple[np.ndarray, str]:
    """
    Segment the nail plate inside a candidate bbox (deterministic, OpenCV).

    Method: Otsu threshold on the grayscale crop (nail plate is the bright
    region the validator's Top-Hat stage keyed on), morphological clean
    (open/close 3x3), keep largest component. Otsu is only meaningful for
    bimodal content, so two homogeneous-crop guards fall back to the
    full-bbox rectangle mask (mask_source="bbox_fallback"):
      - crop grayscale std < 12 (tight box holding only plate tissue);
      - largest-component coverage of the bbox outside [0.25, 0.97].
    Coverage is recorded per nail via the returned mask.

    Returns (mask_full_image, mask_source).
    """
    h, w = img_bgr.shape[:2]
    x, y, bw, bh = bbox
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    crop = gray[y : y + bh, x : x + bw]
    if float(crop.std()) < 12.0:
        mask = np.zeros((h, w), dtype=np.uint8)
        mask[y : y + bh, x : x + bw] = 255
        return mask, "bbox_fallback"
    _, otsu = cv2.threshold(crop, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    cleaned = cv2.morphologyEx(otsu, cv2.MORPH_OPEN, k, iterations=1)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, k, iterations=1)
    mask = np.zeros((h, w), dtype=np.uint8)
    cnts, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if cnts:
        best = max(cnts, key=cv2.contourArea)
        largest_frac = float(cv2.contourArea(best) / max(1, bw * bh))
        if 0.25 <= largest_frac <= 0.97:
            comp = np.zeros_like(cleaned)
            cv2.drawContours(comp, [best], -1, 255, -1)
            mask[y : y + bh, x : x + bw] = comp
            return mask, "otsu_largest_component"
    mask[y : y + bh, x : x + bw] = 255
    return mask, "bbox_fallback"


# ---------------------------------------------------------------------------
# Inner 60% region
# ---------------------------------------------------------------------------


def _inner_60_bbox(
    x: int, y: int, bw: int, bh: int
) -> tuple[int, int, int, int]:
    """
    Central 60% x 60% of a nail bbox: origin at (x + 0.2w, y + 0.2h),
    size (0.6w, 0.6h), rounded, minimum 1px per dim.
    """
    ix = int(round(x + 0.2 * bw))
    iy = int(round(y + 0.2 * bh))
    iw = max(1, int(round(INNER_FRACTION * bw)))
    ih = max(1, int(round(INNER_FRACTION * bh)))
    return (ix, iy, iw, ih)


# ---------------------------------------------------------------------------
# White-reference / illumination normalization
# ---------------------------------------------------------------------------


def _find_white_reference(
    img_bgr: np.ndarray,
    exclude_bboxes: Optional[list[tuple[int, int, int, int]]] = None,
) -> dict[str, Any]:
    """
    Locate a white-background reference region appropriate for smartphone
    nail images (no laboratory fixed coordinates exist in HemoLens).

    Candidate pixels: near-neutral bright background —
      min(R,G,B) > 180, max(R,G,B) - min(R,G,B) < 30,
      HSV S < 45, V > 180.
    The S gate already excludes skin/tissue (skin saturation is far
    higher); the validator's broad YCrCb skin mask is deliberately NOT
    reused here because it also matches neutral white/gray. Nail
    candidate interiors are excluded via `exclude_bboxes` so a pale nail
    plate can never serve as its own reference. The largest cleaned
    component covering >= 0.5% of the frame wins; its per-channel median
    RGB is the reference.

    Returns {"found": bool, "median_rgb": [R,G,B] | None,
             "pixel_count": int, "bbox": {...} | None,
             "reason": str}. Deterministic; never raises.
    """
    try:
        h, w = img_bgr.shape[:2]
        total = h * w
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB).astype(np.int16)
        r, g, b = img_rgb[:, :, 0], img_rgb[:, :, 1], img_rgb[:, :, 2]
        hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
        s, v = hsv[:, :, 1].astype(np.int16), hsv[:, :, 2].astype(np.int16)
        spread = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
        white = (
            (np.minimum(np.minimum(r, g), b) > WHITE_MIN_CHANNEL)
            & (spread < WHITE_MAX_SPREAD)
            & (s < WHITE_MAX_SATURATION)
            & (v > WHITE_MIN_VALUE)
        )
        white_u8 = (white.astype(np.uint8)) * 255
        # Never let a nail plate be its own white reference.
        for eb in exclude_bboxes or []:
            try:
                ex, ey, ebw, ebh = (int(v) for v in eb)
                ex, ey = max(0, ex), max(0, ey)
                ebw, ebh = min(ebw, w - ex), min(ebh, h - ey)
                if ebw > 0 and ebh > 0:
                    white_u8[ey : ey + ebh, ex : ex + ebw] = 0
            except Exception:
                continue
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        white_u8 = cv2.morphologyEx(white_u8, cv2.MORPH_OPEN, k, iterations=1)
        n, labels, stats, _ = cv2.connectedComponentsWithStats(white_u8, 8)
        comps = sorted(
            ((int(stats[i, cv2.CC_STAT_AREA]), i) for i in range(1, n)),
            reverse=True,
        )
        for area, i in comps:
            if area < WHITE_MIN_FRAC * total:
                break
            sel = labels == i
            med = [
                float(np.median(img_rgb[:, :, c][sel])) for c in range(3)
            ]  # RGB order
            x = int(stats[i, cv2.CC_STAT_LEFT])
            yy = int(stats[i, cv2.CC_STAT_TOP])
            bw = int(stats[i, cv2.CC_STAT_WIDTH])
            bh = int(stats[i, cv2.CC_STAT_HEIGHT])
            return {
                "found": True,
                "median_rgb": [round(float(v), 2) for v in med],
                "pixel_count": int(area),
                "bbox": {"x": x, "y": yy, "width": bw, "height": bh,
                         "pixel_count": int(area)},
                "reason": "largest near-neutral bright background component "
                          "outside nail candidates",
            }
        return {
            "found": False,
            "median_rgb": None,
            "pixel_count": 0,
            "bbox": None,
            "reason": "no white-background component >= 0.5% of frame",
        }
    except Exception as exc:
        logger.debug(f"White-reference search failed: {exc}")
        return {
            "found": False,
            "median_rgb": None,
            "pixel_count": 0,
            "bbox": None,
            "reason": f"search error: {exc}",
        }


def normalize_by_white_reference(
    pixels_rgb: np.ndarray, white_rgb: Optional[list[float] | tuple[float, ...] | np.ndarray]
) -> tuple[np.ndarray, list[float], str]:
    """
    Normalize RGB intensities against a white reference.

    Formula (per channel c, deterministic):
        scale_c = 128 / max(white_c, eps);  out = clip(raw * scale_c, 0, 255)

    Scaling toward mid-gray 128 removes global illumination gain while
    keeping values in display range. If `white_rgb` is missing,
    non-positive, or non-finite, NO scaling is applied (explicit
    `unnormalized_fallback`); a reference is never invented.

    Returns (normalized_pixels, scale_rgb, method) where method is
    "white_reference_scale128_clip0_255" or "unnormalized_fallback".
    """
    px = np.asarray(pixels_rgb, dtype=np.float64).reshape(-1, 3)
    try:
        if white_rgb is None:
            raise ValueError("no white reference")
        w = np.asarray(white_rgb, dtype=np.float64).reshape(3)
        if w.size != 3 or not np.all(np.isfinite(w)) or np.any(w <= 0):
            raise ValueError(f"invalid white reference {white_rgb}")
        eps = 1e-6
        scale = 128.0 / np.maximum(w, eps)
        out = np.clip(px * scale[None, :], 0.0, 255.0)
        return out, [float(s) for s in scale], "white_reference_scale128_clip0_255"
    except Exception:
        return px, [1.0, 1.0, 1.0], "unnormalized_fallback"


# ---------------------------------------------------------------------------
# RGB percentile descriptors
# ---------------------------------------------------------------------------


def _rgb_percentiles(pixels_rgb: np.ndarray) -> dict[str, list[float]]:
    """
    7 percentile levels per R/G/B channel (linear interpolation, the
    numpy default — deterministic). Empty input yields zeros (never NaN).
    Returns {"r": [...7...], "g": [...7...], "b": [...7...]} in RGB order.
    """
    px = np.asarray(pixels_rgb, dtype=np.float64).reshape(-1, 3)
    out: dict[str, list[float]] = {}
    if px.shape[0] == 0:
        return {"r": [0.0] * 7, "g": [0.0] * 7, "b": [0.0] * 7}
    for idx, ch in enumerate(("r", "g", "b")):
        vals = np.percentile(px[:, idx], list(PERCENTILES))
        cleaned = [float(v) if math.isfinite(float(v)) else 0.0 for v in vals]
        out[ch] = cleaned
    return out


def _ordered_vector(per_ch: dict[str, list[float]]) -> list[float]:
    """Flatten per-channel percentiles to FEATURE_NAMES order (r,g,b x 7)."""
    vec: list[float] = []
    for ch in ("r", "g", "b"):
        for v in per_ch[ch]:
            vec.append(float(v) if math.isfinite(float(v)) else 0.0)
    assert len(vec) == FEATURE_DIM
    return vec


# ---------------------------------------------------------------------------
# ROI-marked image (nail-specific; eyelid implementation untouched)
# ---------------------------------------------------------------------------


def create_nail_roi_marked_image(
    original_bgr: np.ndarray,
    valid_nails: list[dict[str, Any]],
    rejected_bboxes: list[tuple[int, int, int, int]],
) -> np.ndarray:
    """
    Frontend-visible ROI overlay. Original is never modified.

    - Accepted nail: green bbox (2px) + cyan inner-60% rect (2px) +
      yellow plate contour (1px) + numbered label "N1..Nn" above the box.
    - Rejected candidate: thin red bbox (1px), no inner rect.
    Lines are thin so the nail plate stays visible.
    """
    marked = original_bgr.copy()
    # Rejected first (underneath), then accepted.
    for (x, y, bw, bh) in rejected_bboxes:
        cv2.rectangle(marked, (x, y), (x + bw, y + bh), (0, 0, 255), 1)
    for i, nail in enumerate(valid_nails, start=1):
        b = nail["bbox"]
        x, y, bw, bh = b["x"], b["y"], b["width"], b["height"]
        inner = nail["inner_bbox"]
        # Plate contour (yellow, thin).
        try:
            cnts, _ = cv2.findContours(
                nail["_mask"], cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )
            cv2.drawContours(marked, cnts, -1, (0, 255, 255), 1)
        except Exception:
            pass
        cv2.rectangle(marked, (x, y), (x + bw, y + bh), (0, 255, 0), 2)
        cv2.rectangle(
            marked,
            (inner["x"], inner["y"]),
            (inner["x"] + inner["width"], inner["y"] + inner["height"]),
            (255, 255, 0),
            2,
        )
        label = f"N{i}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
        lx, ly = x, max(0, y - th - 8)
        cv2.rectangle(marked, (lx, ly), (lx + tw + 6, ly + th + 6), (0, 0, 0), -1)
        cv2.putText(
            marked, label, (lx + 3, ly + th + 3),
            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA,
        )
    # Strip internal-only keys before returning (defensive: callers get a
    # pure image; per-nail dicts are sanitized separately below).
    return marked


def _sanitize_nail(nail: dict[str, Any]) -> dict[str, Any]:
    """Remove internal mask arrays from a per-nail record for JSON output."""
    return {k: v for k, v in nail.items() if not k.startswith("_")}


# ---------------------------------------------------------------------------
# Public isolated function (called by API and tests)
# ---------------------------------------------------------------------------


def extract_nail_features(
    raw_bytes: bytes,
    screening_id: Optional[str] = None,
    output_dir: Optional[Path] = None,
    save_images: bool = True,
) -> dict[str, Any]:
    """
    Isolated deterministic nail-bed feature extraction.

    Input: raw bytes of a nail image that ALREADY passed
      `POST /api/screen/validate-image-nail` (only a decode check runs here).

    Output (success):
      {
        "success": True,
        "feature_vector": [...21 floats...],   # median-aggregated, nail_rgb_v1
        "feature_names": FEATURE_NAMES,        # r_p05..b_p95, fixed order
        "roi": {x,y,width,height,pixel_count,nail_id},  # primary (largest)
        "nail_rois": [...],                    # one bbox dict per valid nail
        "nail_count": int,                     # number of VALID nails
        "per_nail_features": [...],            # 21-vector + metadata per nail
        "original_image_reference": str,
        "roi_marked_image_reference": str,
        "original_image_base64": str,
        "roi_marked_image_base64": str,
        "meta": {schema_version, aggregation, n_detected, n_valid,
                 white_reference, normalization, saturation, inner_fraction, ...}
      }

    Output (failure): {"success": False, "error": str, "reason": str,
      "roi": None, "feature_vector": [], "feature_names": FEATURE_NAMES,
      "nail_count": 0, "per_nail_features": [...attempts...], "meta": {...}}.

    Never fabricates features. Modular: extra color descriptors can be
    appended later without changing the 21 core names/order.
    """
    # ---- Step 0: lightweight decode check only (validation ran upstream).
    img_bgr = _decode_image_bytes(raw_bytes) if raw_bytes else None
    if img_bgr is None:
        return {
            "success": False,
            "error": "DECODE_FAILED",
            "reason": "Could not decode image bytes as BGR image.",
            "roi": None,
            "feature_vector": [],
            "feature_names": FEATURE_NAMES,
            "nail_count": 0,
            "per_nail_features": [],
            "meta": {"schema_version": SCHEMA_VERSION},
        }

    h, w = img_bgr.shape[:2]
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

    # ---- Step 1: hand-prioritized candidates first (extractor-local
    # MediaPipe Hands fingertip crops + distal-plate fallback for fist
    # close-ups); legacy validator Top-Hat reuse as the last resort so
    # behaviour can never regress to zero candidates.
    candidates = _get_hand_prioritized_candidates(img_bgr)
    if not candidates:
        candidates = _get_nail_candidates(img_bgr)
    n_detected = len(candidates)
    if n_detected == 0:
        # Blank marked image (original preserved underneath) for visibility.
        marked_empty = original_bgr_copy = img_bgr.copy()
        orig_ref, marked_ref, orig_b64, marked_b64 = _persist_or_stub(
            img_bgr, marked_empty, screening_id, output_dir, save_images
        )
        return {
            "success": False,
            "error": "INVALID_ROI",
            "reason": "No usable nail ROIs: detector returned zero candidates.",
            "roi": None,
            "feature_vector": [],
            "feature_names": FEATURE_NAMES,
            "nail_count": 0,
            "per_nail_features": [],
            "original_image_reference": orig_ref,
            "roi_marked_image_reference": marked_ref,
            "original_image_base64": orig_b64,
            "roi_marked_image_base64": marked_b64,
            "meta": {
                "schema_version": SCHEMA_VERSION,
                "n_detected": 0,
                "n_valid": 0,
            },
        }

    # ---- Step 2: global white reference (once per image; nail interiors
    # excluded so a plate can never be its own reference).
    _cand_boxes: list[tuple[int, int, int, int]] = []
    for _c in candidates:
        try:
            _cand_boxes.append(tuple(int(v) for v in _c.get("bbox", (0, 0, 0, 0))))  # type: ignore[arg-type]
        except Exception:
            continue
    white_info = _find_white_reference(img_bgr, exclude_bboxes=_cand_boxes)
    white_rgb = white_info["median_rgb"] if white_info["found"] else None

    # ---- Steps 3-5: per-nail inner region + percentiles.
    valid_nails: list[dict[str, Any]] = []
    rejected_bboxes: list[tuple[int, int, int, int]] = []
    attempts: list[dict[str, Any]] = []
    total_clipped = 0
    total_inner = 0

    for idx, cand in enumerate(candidates):
        raw_bbox = cand.get("bbox", (0, 0, 0, 0))
        try:
            bx, by, bbw, bbh = (int(v) for v in raw_bbox)
        except Exception:
            attempts.append({"candidate_index": idx, "valid": False,
                             "reason": "malformed bbox"})
            continue
        clipped = _clip_bbox((bx, by, bbw, bbh), w, h)
        if clipped is None:
            attempts.append({"candidate_index": idx, "valid": False,
                             "reason": "bbox degenerate after clipping"})
            rejected_bboxes.append((max(0, bx), max(0, by), max(1, bbw), max(1, bbh)))
            continue
        cx, cy, cbw, cbh = clipped
        plate_mask, mask_source = _nail_plate_mask(img_bgr, clipped)
        ix, iy, iw, ih = _inner_60_bbox(cx, cy, cbw, cbh)
        # Clamp inner rect to image.
        ix = max(0, min(ix, w - 1))
        iy = max(0, min(iy, h - 1))
        iw = max(1, min(iw, w - ix))
        ih = max(1, min(ih, h - iy))
        inner_mask = plate_mask[iy : iy + ih, ix : ix + iw]
        inner_count = int(cv2.countNonZero(inner_mask))
        inner_frac = float(inner_count / max(1, iw * ih))
        total_inner += inner_count

        if inner_count < MIN_INNER_PIXELS or inner_frac < MIN_INNER_FRAC:
            attempts.append({
                "candidate_index": idx, "valid": False,
                "reason": (f"insufficient valid pixels in inner 60% region "
                           f"({inner_count}px, frac {inner_frac:.3f})"),
                "bbox": {"x": cx, "y": cy, "width": cbw, "height": cbh},
            })
            rejected_bboxes.append(clipped)
            continue

        # Gather inner-region RGB pixels (RGB order).
        ys, xs = np.where(plate_mask > 0)
        in_inner = (xs >= ix) & (xs < ix + iw) & (ys >= iy) & (ys < iy + ih)
        px_rgb = img_rgb[ys[in_inner], xs[in_inner]].astype(np.float64)

        # Saturation/clipping exclusion (any channel near 0 or 255).
        sat = (
            (px_rgb[:, 0] <= SAT_LOW) | (px_rgb[:, 0] >= SAT_HIGH)
            | (px_rgb[:, 1] <= SAT_LOW) | (px_rgb[:, 1] >= SAT_HIGH)
            | (px_rgb[:, 2] <= SAT_LOW) | (px_rgb[:, 2] >= SAT_HIGH)
        )
        n_clipped = int(np.count_nonzero(sat))
        total_clipped += n_clipped
        px_clean = px_rgb[~sat]
        clipped_frac = float(n_clipped / max(1, px_rgb.shape[0]))
        if px_clean.shape[0] < MIN_INNER_PIXELS:
            attempts.append({
                "candidate_index": idx, "valid": False,
                "reason": (f"insufficient valid pixels after saturation exclusion "
                           f"({px_clean.shape[0]}px, clipped {clipped_frac:.3f})"),
                "bbox": {"x": cx, "y": cy, "width": cbw, "height": cbh},
            })
            rejected_bboxes.append(clipped)
            continue

        # Normalize against the white reference, then percentiles.
        px_norm, scale, norm_method = normalize_by_white_reference(px_clean, white_rgb)
        per_ch = _rgb_percentiles(px_norm)
        vector = _ordered_vector(per_ch)
        nail_id = idx + 1
        record: dict[str, Any] = {
            "nail_id": nail_id,
            "candidate_index": idx,
            "valid": True,
            "bbox": {"x": cx, "y": cy, "width": cbw, "height": cbh,
                     "pixel_count": int(cv2.countNonZero(
                         plate_mask[cy : cy + cbh, cx : cx + cbw]))},
            "inner_bbox": {"x": ix, "y": iy, "width": iw, "height": ih,
                           "pixel_count": int(inner_count)},
            "pixel_count": int(px_clean.shape[0]),
            "clipped_fraction": round(clipped_frac, 4),
            "mask_source": mask_source,
            "normalization": norm_method,
            "feature_vector": vector,
            "features": {name: val for name, val in zip(FEATURE_NAMES, vector)},
            "_mask": plate_mask,
        }
        valid_nails.append(record)
        attempts.append(_sanitize_nail(record))

    n_valid = len(valid_nails)
    if n_valid < MIN_VALID_NAILS:
        marked = create_nail_roi_marked_image(img_bgr, [], rejected_bboxes)
        orig_ref, marked_ref, orig_b64, marked_b64 = _persist_or_stub(
            img_bgr, marked, screening_id, output_dir, save_images
        )
        return {
            "success": False,
            "error": "INVALID_ROI",
            "reason": (f"No usable nail ROIs: {n_valid} valid of "
                       f"{n_detected} detected candidates."),
            "roi": None,
            "feature_vector": [],
            "feature_names": FEATURE_NAMES,
            "nail_count": 0,
            "per_nail_features": attempts,
            "original_image_reference": orig_ref,
            "roi_marked_image_reference": marked_ref,
            "original_image_base64": orig_b64,
            "roi_marked_image_base64": marked_b64,
            "meta": {
                "schema_version": SCHEMA_VERSION,
                "n_detected": n_detected,
                "n_valid": 0,
                "white_reference": white_info,
                "inner_fraction": INNER_FRACTION,
            },
        }

    # ---- Step 6: deterministic aggregation (element-wise median).
    stacked = np.array([n["feature_vector"] for n in valid_nails], dtype=np.float64)
    aggregated = np.median(stacked, axis=0)
    feature_vector = [float(v) if math.isfinite(float(v)) else 0.0 for v in aggregated]
    assert len(feature_vector) == FEATURE_DIM
    assert all(math.isfinite(v) for v in feature_vector)

    # Primary ROI = largest valid nail (by clean pixel count).
    primary = max(valid_nails, key=lambda n: n["pixel_count"])
    pb = primary["bbox"]
    roi = {"x": int(pb["x"]), "y": int(pb["y"]), "width": int(pb["width"]),
           "height": int(pb["height"]), "pixel_count": int(primary["pixel_count"]),
           "nail_id": int(primary["nail_id"])}

    marked = create_nail_roi_marked_image(img_bgr, valid_nails, rejected_bboxes)
    orig_ref, marked_ref, orig_b64, marked_b64 = _persist_or_stub(
        img_bgr, marked, screening_id, output_dir, save_images
    )

    # Scale actually applied (shared across nails).
    _, applied_scale, norm_method_global = normalize_by_white_reference(
        np.zeros((1, 3)), white_rgb
    )
    overall_clipped = float(total_clipped / max(1, total_inner))

    return {
        "success": True,
        "feature_vector": feature_vector,
        "feature_names": FEATURE_NAMES,
        "roi": roi,
        "nail_rois": [
            {"x": n["bbox"]["x"], "y": n["bbox"]["y"], "width": n["bbox"]["width"],
             "height": n["bbox"]["height"], "pixel_count": n["bbox"]["pixel_count"],
             "nail_id": n["nail_id"]}
            for n in valid_nails
        ],
        "nail_count": int(n_valid),
        "per_nail_features": [_sanitize_nail(n) for n in valid_nails],
        "original_image_reference": orig_ref,
        "roi_marked_image_reference": marked_ref,
        "original_image_base64": orig_b64,
        "roi_marked_image_base64": marked_b64,
        "meta": {
            "schema_version": SCHEMA_VERSION,
            "aggregation": AGGREGATION_METHOD,
            "n_detected": int(n_detected),
            "n_valid": int(n_valid),
            "feature_dim": FEATURE_DIM,
            "white_reference": white_info,
            "normalization": {
                "method": norm_method_global,
                "scale_rgb": [round(float(s), 6) for s in applied_scale],
                "formula": "normalized_c = clip(raw_c * (128 / white_c), 0, 255) "
                           "per channel; unnormalized_fallback uses scale 1.0",
            },
            "saturation": {
                "excluded_low": SAT_LOW,
                "excluded_high": SAT_HIGH,
                "overall_clipped_fraction": round(overall_clipped, 4),
                "rule": "pixel excluded if ANY of R/G/B <= 8 or >= 247",
            },
            "inner_fraction": INNER_FRACTION,
            "percentiles": list(PERCENTILES),
        },
    }


def _persist_or_stub(
    original_bgr: np.ndarray,
    marked_bgr: np.ndarray,
    screening_id: Optional[str],
    output_dir: Optional[Path],
    save_images: bool,
) -> tuple[str, str, str, str]:
    """Save images (or stub refs) + base64, mirroring eyelid behavior."""
    try:
        orig_b64 = _encode_image_base64(original_bgr)
        marked_b64 = _encode_image_base64(marked_bgr)
    except Exception as exc:
        logger.warning(f"Base64 encode failed: {exc}")
        orig_b64, marked_b64 = "", ""
    if save_images:
        try:
            orig_ref, marked_ref = _save_images(
                original_bgr, marked_bgr,
                screening_id=screening_id, output_dir=output_dir,
            )
        except Exception as exc:
            logger.warning(f"Could not save nail ROI images: {exc}")
            orig_ref, marked_ref = "original_not_saved", "marked_not_saved"
    else:
        orig_ref = "not_saved (save_images=False)"
        marked_ref = "not_saved (save_images=False)"
    return orig_ref, marked_ref, orig_b64, marked_b64
