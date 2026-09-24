"""
HemoLens Backend — POST /api/screen/validate-image
===================================================
Validates an uploaded eyelid image through an ordered pipeline of
deterministic OpenCV checks and MediaPipe Face Landmarker detection.

Uses MediaPipe Tasks API (mediapipe>=0.10.x) which requires a model bundle.
The model file (face_landmarker.task) is downloaded once into backend/models/
on first startup.

No ML inference, no Supabase storage, no image is persisted.

Response schema (always HTTP 200):
{
    "valid": bool,
    "message": str,
    "checks": {
        "resolution": bool,
        "blur": bool,
        "brightness": bool,
        "eye_detection": bool,
        "eyelid_visibility": bool
    },
    "errors": [
        { "code": str, "message": str }
    ]
}
"""

from __future__ import annotations

import logging
import os
import urllib.request
from pathlib import Path
from typing import Any

import cv2
import mediapipe.tasks as mp_tasks
import numpy as np
from fastapi import APIRouter, File, UploadFile, HTTPException
from pydantic import BaseModel

try:
    from backend import config
except ModuleNotFoundError:
    import config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/screen", tags=["screening"])

# ---------------------------------------------------------------------------
# MediaPipe Face Landmarker model — downloaded once at startup
# ---------------------------------------------------------------------------
# Lite model: 7.1 MB. Full model also available but unnecessary for validation.
_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
    "face_landmarker/float16/latest/face_landmarker.task"
)
_MODEL_DIR = Path(__file__).parent.parent / "models"
_MODEL_PATH = _MODEL_DIR / "face_landmarker.task"


def _ensure_model() -> Path:
    """Download the Face Landmarker model bundle if not already present."""
    _MODEL_DIR.mkdir(parents=True, exist_ok=True)
    if not _MODEL_PATH.exists():
        logger.info(
            "Downloading MediaPipe Face Landmarker model (~7 MB) to %s …", _MODEL_PATH
        )
        urllib.request.urlretrieve(_MODEL_URL, _MODEL_PATH)
        logger.info("Model download complete.")
    return _MODEL_PATH


# Initialise landmarker once at import time (module-level singleton).
# This avoids re-loading the model on every request.
try:
    _model_path = _ensure_model()
    _BaseOptions = mp_tasks.BaseOptions
    _FaceLandmarker = mp_tasks.vision.FaceLandmarker
    _FaceLandmarkerOptions = mp_tasks.vision.FaceLandmarkerOptions
    _RunningMode = mp_tasks.vision.RunningMode
    _VisionRunningMode = _RunningMode.IMAGE

    _landmarker_options = _FaceLandmarkerOptions(
        base_options=_BaseOptions(model_asset_path=str(_model_path)),
        running_mode=_VisionRunningMode,
        num_faces=config.FACE_MESH_MAX_FACES,
        min_face_detection_confidence=config.FACE_MESH_MIN_DETECTION_CONFIDENCE,
        min_face_presence_confidence=config.FACE_MESH_MIN_TRACKING_CONFIDENCE,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
    )
    _landmarker = _FaceLandmarker.create_from_options(_landmarker_options)
    logger.info("MediaPipe FaceLandmarker initialised successfully.")
    _LANDMARKER_READY = True
except Exception as _init_err:
    logger.warning(
        "MediaPipe FaceLandmarker could not be initialised: %s. "
        "Eye detection checks will be skipped.",
        _init_err,
    )
    _landmarker = None
    _LANDMARKER_READY = False


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class ChecksResult(BaseModel):
    resolution: bool = False
    blur: bool = False
    brightness: bool = False
    eye_detection: bool = False
    eyelid_visibility: bool = False


class ValidationError(BaseModel):
    code: str
    message: str


class ValidationResponse(BaseModel):
    valid: bool
    message: str
    checks: ChecksResult
    errors: list[ValidationError]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _decode_image(raw_bytes: bytes) -> np.ndarray | None:
    """Decode raw bytes into a BGR NumPy array via OpenCV."""
    arr = np.frombuffer(raw_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img  # None if decoding failed


def _check_resolution(img: np.ndarray) -> tuple[bool, dict[str, Any]]:
    """Return (passed, meta) for the resolution check."""
    h, w = img.shape[:2]
    passed = w >= config.MIN_WIDTH and h >= config.MIN_HEIGHT
    return passed, {"width": w, "height": h}


def _check_blur(gray: np.ndarray) -> tuple[bool, dict[str, Any]]:
    """Variance of Laplacian blur detection on standardized scale (max dimension 1024px)."""
    h, w = gray.shape[:2]
    scale = min(1.0, config.BLUR_NORM_MAX_DIM / max(h, w))
    if scale < 1.0:
        res = cv2.resize(gray, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    else:
        res = gray
    variance = float(cv2.Laplacian(res, cv2.CV_64F).var())
    passed = variance >= config.BLUR_THRESHOLD
    return passed, {"laplacian_variance": round(variance, 2), "threshold": config.BLUR_THRESHOLD}


def _check_brightness(gray: np.ndarray) -> tuple[bool, dict[str, Any]]:
    """Mean pixel value as a proxy for brightness / exposure."""
    mean_brightness = float(gray.mean())
    too_dark = mean_brightness < config.MIN_BRIGHTNESS
    overexposed = mean_brightness > config.MAX_BRIGHTNESS
    passed = not too_dark and not overexposed
    return passed, {
        "mean_brightness": round(mean_brightness, 1),
        "too_dark": too_dark,
        "overexposed": overexposed,
    }


def _get_landmark_px(
    landmark: Any,
    img_w: int,
    img_h: int,
) -> tuple[float, float]:
    """Convert a normalised NormalizedLandmark to absolute pixel coordinates."""
    return landmark.x * img_w, landmark.y * img_h


def _check_closeup_eyelid(img_rgb: np.ndarray) -> tuple[bool, bool, dict[str, Any]]:
    """
    Validation check for macro / close-up eyelid images where full face geometry
    is cropped out, preventing MediaPipe BlazeFace from detecting standard face landmarks.

    Evaluates:
      1. Sclera (white of the eye) presence.
      2. Mucosal / pink-red palpebral conjunctival tissue presence.
    """
    img_h, img_w = img_rgb.shape[:2]
    total_pixels = img_h * img_w

    # Sclera (white of eye)
    hsv = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2HSV)
    sclera_mask = cv2.inRange(hsv, np.array([0, 0, 130]), np.array([180, 50, 255]))
    sclera_px = int(np.count_nonzero(sclera_mask))
    sclera_frac = sclera_px / total_pixels

    # Palpebral conjunctival mucosa (vascular deep red/pink tissue)
    r = img_rgb[:, :, 0].astype(float)
    g = img_rgb[:, :, 1].astype(float)
    b = img_rgb[:, :, 2].astype(float)
    mucosa_mask = (r > 80) & (r - g > 30) & (r - b > 40)
    mucosa_px = int(np.count_nonzero(mucosa_mask))
    mucosa_frac = mucosa_px / total_pixels

    has_sclera = (sclera_px >= config.MIN_MACRO_SCLERA_PX) or (sclera_frac >= config.MIN_MACRO_SCLERA_FRACTION)
    has_conjunctiva = mucosa_frac >= config.MIN_MACRO_CONJUNCTIVA_FRACTION

    eye_detected = has_sclera
    eyelid_visible = has_sclera and has_conjunctiva

    meta = {
        "detection_mode": "macro_closeup",
        "sclera_px": sclera_px,
        "sclera_frac": round(sclera_frac, 4),
        "mucosa_frac": round(mucosa_frac, 4),
        "has_sclera": has_sclera,
        "has_conjunctiva": has_conjunctiva,
    }

    return eye_detected, eyelid_visible, meta


def _check_eye_and_eyelid(
    img_rgb: np.ndarray,
) -> tuple[bool, bool, dict[str, Any]]:
    """
    Run MediaPipe Face Landmarker (or fallback close-up detector) and evaluate:
      1. eye_detection  — eye found and spans enough of the frame.
      2. eyelid_visibility — lower eyelid and palpebral conjunctiva adequately visible.

    Returns (eye_detected: bool, eyelid_visible: bool, meta: dict)
    """
    if not _LANDMARKER_READY or _landmarker is None:
        return _check_closeup_eyelid(img_rgb)

    img_h, img_w = img_rgb.shape[:2]

    # MediaPipe Tasks API uses mp_tasks.vision.Image
    import mediapipe as mp
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_rgb)

    result = _landmarker.detect(mp_image)

    if not result.face_landmarks:
        # If full face geometry is not present (e.g. macro close-up of eye/eyelid),
        # use close-up ocular tissue validation as fallback
        return _check_closeup_eyelid(img_rgb)

    landmarks = result.face_landmarks[0]  # first (and only) face

    def lm_px(idx: int) -> tuple[float, float]:
        return _get_landmark_px(landmarks[idx], img_w, img_h)

    # ---- Eye region size (right eye outer → inner corner) ----
    r_outer = lm_px(config.RIGHT_EYE_CORNER_INDICES[0])
    r_inner = lm_px(config.RIGHT_EYE_CORNER_INDICES[1])
    l_outer = lm_px(config.LEFT_EYE_CORNER_INDICES[0])
    l_inner = lm_px(config.LEFT_EYE_CORNER_INDICES[1])

    right_eye_width = abs(r_inner[0] - r_outer[0])
    left_eye_width = abs(l_inner[0] - l_outer[0])
    max_eye_width = max(right_eye_width, left_eye_width)
    eye_region_fraction = max_eye_width / img_w

    # Ensure eye is framed large enough in the image
    is_framed_large_enough = (max_eye_width >= config.MIN_FACE_EYE_WIDTH_PX) or (eye_region_fraction >= config.MIN_FACE_EYE_FRACTION)

    if not is_framed_large_enough:
        return False, False, {
            "face_detected": True,
            "eye_width_px": round(max_eye_width, 1),
            "eye_region_fraction": round(eye_region_fraction, 3),
            "framing_error": "EYELID_AREA_NOT_BIG_ENOUGH",
        }

    # ---- Dominant eye (larger = likely closer to camera) ----
    if right_eye_width >= left_eye_width:
        upper_idx = config.RIGHT_EYE_UPPER_INDICES
        lower_idx = config.RIGHT_EYE_LOWER_INDICES
        corner_idx = config.RIGHT_EYE_CORNER_INDICES
    else:
        upper_idx = config.LEFT_EYE_UPPER_INDICES
        lower_idx = config.LEFT_EYE_LOWER_INDICES
        corner_idx = config.LEFT_EYE_CORNER_INDICES

    # ---- Eye Aspect Ratio (vertical openness check) ----
    upper_pts = [lm_px(i) for i in upper_idx]
    lower_pts_subset = [lm_px(i) for i in lower_idx[:len(upper_idx)]]
    vertical = float(np.mean([abs(u[1] - lo[1]) for u, lo in zip(upper_pts, lower_pts_subset)]))
    c0 = lm_px(corner_idx[0])
    c1 = lm_px(corner_idx[1])
    horizontal = abs(c1[0] - c0[0]) + 1e-6
    ear = vertical / horizontal

    eye_open = ear >= config.MIN_EYE_ASPECT_RATIO

    # ---- Lower-eyelid vertical spread ----
    lower_pts_y = [lm_px(i)[1] for i in lower_idx]
    lower_eyelid_spread = (max(lower_pts_y) - min(lower_pts_y)) / img_h
    eyelid_spread_ok = lower_eyelid_spread >= config.MIN_LOWER_EYELID_VERTICAL_FRACTION

    eyelid_visible = eye_open and eyelid_spread_ok

    # If landmark EAR fails due to extreme downward eversion, double check closeup mucosa
    if not eyelid_visible:
        c_eye, c_lid, _ = _check_closeup_eyelid(img_rgb)
        if c_lid:
            eyelid_visible = True

    return True, eyelid_visible, {
        "face_detected": True,
        "eye_width_px": round(max_eye_width, 1),
        "eye_region_fraction": round(eye_region_fraction, 3),
        "eye_aspect_ratio": round(ear, 3),
        "eye_open": eye_open,
        "lower_eyelid_spread": round(lower_eyelid_spread, 4),
        "eyelid_spread_ok": eyelid_spread_ok,
    }


# ---------------------------------------------------------------------------
# Error catalogue
# ---------------------------------------------------------------------------

_ERRORS: dict[str, str] = {
    "DECODE_FAILED":
        "Could not read the image file. Please upload a valid JPEG or PNG.",
    "RESOLUTION_TOO_LOW":
        f"Image resolution is too low (minimum: "
        f"{config.MIN_WIDTH}x{config.MIN_HEIGHT} px). "
        "Please use a higher-quality image or move closer.",
    "IMAGE_TOO_BLURRY":
        "Image is too blurry. Hold the camera steady, ensure good lighting, "
        "and tap to focus before capturing.",
    "IMAGE_TOO_DARK":
        "Image is too dark. Move to a well-lit area or switch on a light "
        "facing your face before retaking.",
    "IMAGE_OVEREXPOSED":
        "Image is overexposed / too bright. Avoid direct light sources "
        "shining into the lens and retake.",
    "EYE_NOT_DETECTED":
        "No eye detected in the image. Position your lower eyelid clearly "
        "in the centre of the frame and ensure your face is visible.",
    "EYELID_AREA_NOT_BIG_ENOUGH":
        "The eye is too far from the camera or poorly framed. Please move closer "
        "so that your eye and lower eyelid occupy the majority of the frame.",
    "EYELID_NOT_VISIBLE":
        "The lower eyelid conjunctiva is not sufficiently exposed. Gently "
        "pull your lower eyelid downward until the pink tissue is clearly "
        "visible, then retake.",
}


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post(
    "/validate-image-eyelid",
    response_model=ValidationResponse,
    summary="Validate an eyelid image for quality before analysis",
    description=(
        "Accepts a multipart image upload and runs a sequential pipeline of "
        "deterministic quality checks: resolution, blur, brightness, eye "
        "detection (MediaPipe Face Landmarker), and lower-eyelid landmark "
        "visibility. Always returns HTTP 200; use the `valid` field to "
        "determine pass/fail. No image data is stored or forwarded to Supabase."
    ),
)
async def validate_image_eyelid(
    image: UploadFile = File(..., description="Lower-eyelid image (JPEG/PNG/WebP)"),
) -> ValidationResponse:
    checks = ChecksResult()
    errors: list[ValidationError] = []

    # ------------------------------------------------------------------ #
    # Step 0 — Read & decode                                              #
    # ------------------------------------------------------------------ #
    try:
        raw_bytes = await image.read()
    except Exception as exc:
        logger.exception("Failed to read uploaded file: %s", exc)
        raise HTTPException(status_code=400, detail="Could not read the uploaded file.") from exc

    img_bgr = _decode_image(raw_bytes)
    if img_bgr is None:
        errors.append(ValidationError(code="DECODE_FAILED", message=_ERRORS["DECODE_FAILED"]))
        return ValidationResponse(
            valid=False,
            message="Image could not be decoded.",
            checks=checks,
            errors=errors,
        )

    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

    # ------------------------------------------------------------------ #
    # Step 1 — Resolution                                                 #
    # ------------------------------------------------------------------ #
    res_ok, res_meta = _check_resolution(img_bgr)
    checks.resolution = res_ok
    if not res_ok:
        errors.append(ValidationError(code="RESOLUTION_TOO_LOW", message=_ERRORS["RESOLUTION_TOO_LOW"]))
        logger.info("Resolution check failed: %s", res_meta)

    # ------------------------------------------------------------------ #
    # Step 2 — Blur                                                       #
    # ------------------------------------------------------------------ #
    blur_ok, blur_meta = _check_blur(gray)
    checks.blur = blur_ok
    if not blur_ok:
        errors.append(ValidationError(code="IMAGE_TOO_BLURRY", message=_ERRORS["IMAGE_TOO_BLURRY"]))
        logger.info("Blur check failed: %s", blur_meta)

    # ------------------------------------------------------------------ #
    # Step 3 — Brightness / exposure                                      #
    # ------------------------------------------------------------------ #
    bright_ok, bright_meta = _check_brightness(gray)
    checks.brightness = bright_ok
    if not bright_ok:
        code = "IMAGE_OVEREXPOSED" if bright_meta["overexposed"] else "IMAGE_TOO_DARK"
        errors.append(ValidationError(code=code, message=_ERRORS[code]))
        logger.info("Brightness check failed: %s", bright_meta)

    # ------------------------------------------------------------------ #
    # Steps 4 & 5 — Face Landmarker: eye detection + eyelid visibility    #
    # ------------------------------------------------------------------ #
    try:
        eye_ok, eyelid_ok, mesh_meta = _check_eye_and_eyelid(img_rgb)
    except Exception as exc:
        logger.exception("MediaPipe FaceLandmarker error: %s", exc)
        # Treat as not detected rather than crashing the response
        eye_ok, eyelid_ok, mesh_meta = False, False, {"error": str(exc)}

    checks.eye_detection = eye_ok
    checks.eyelid_visibility = eyelid_ok

    if not eye_ok:
        err_code = mesh_meta.get("framing_error", "EYE_NOT_DETECTED")
        errors.append(ValidationError(code=err_code, message=_ERRORS[err_code]))
        logger.info("Eye detection failed: %s", mesh_meta)
    elif not eyelid_ok:
        errors.append(ValidationError(code="EYELID_NOT_VISIBLE", message=_ERRORS["EYELID_NOT_VISIBLE"]))
        logger.info("Eyelid visibility failed: %s", mesh_meta)

    # ------------------------------------------------------------------ #
    # Build response                                                       #
    # ------------------------------------------------------------------ #
    valid = not errors
    failed_count = len(errors)

    if valid:
        message = "Image passed all quality checks."
    elif failed_count == 1:
        message = "Image failed 1 quality check."
    else:
        message = f"Image failed {failed_count} quality check(s)."

    logger.info(
        "validate-image | valid=%s | checks=%s | errors=%s",
        valid,
        checks.model_dump(),
        [e.code for e in errors],
    )

    return ValidationResponse(
        valid=valid,
        message=message,
        checks=checks,
        errors=errors,
    )


# ===========================================================================
# NAIL-BED IMAGE VALIDATION
# ===========================================================================

class NailChecksResult(BaseModel):
    resolution: bool = False
    blur: bool = False
    brightness: bool = False
    nail_detection: bool = False
    nail_quality: bool = False


class NailValidationResponse(BaseModel):
    valid: bool
    message: str
    checks: NailChecksResult
    errors: list[ValidationError]
    nail_count: int = 0


def _check_nail_blur(img_bgr: np.ndarray, gray: np.ndarray) -> tuple[bool, dict[str, Any]]:
    """Standardized sharpness check tailored for skin & nail bed regions."""
    h, w = gray.shape[:2]
    scale = min(1.0, config.BLUR_NORM_MAX_DIM / max(h, w))
    res = cv2.resize(gray, (int(w * scale), int(h * scale))) if scale < 1.0 else gray

    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    ycrcb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2YCrCb)
    skin = cv2.bitwise_or(
        cv2.inRange(hsv, (0, 10, 30), (35, 255, 255)),
        cv2.inRange(ycrcb, (0, 125, 70), (255, 185, 140)),
    )
    skin_res = cv2.resize(skin, (res.shape[1], res.shape[0])) if scale < 1.0 else skin

    gx = cv2.Sobel(res, cv2.CV_64F, 1, 0)
    gy = cv2.Sobel(res, cv2.CV_64F, 0, 1)
    mag = np.hypot(gx, gy)
    skin_mag = mag[skin_res > 0]

    tenengrad = float((skin_mag**2).mean()) if len(skin_mag) > 0 else 0.0
    passed = tenengrad >= config.NAIL_BLUR_THRESHOLD
    return passed, {"tenengrad": round(tenengrad, 1), "threshold": config.NAIL_BLUR_THRESHOLD}


def _detect_nail_candidates(img_bgr: np.ndarray) -> list[dict[str, Any]]:
    """
    Detects fingernail candidates using robust multi-cue OpenCV processing:
    1. Broad skin segmentation (HSV + YCrCb) covering all skin complexions.
    2. Multi-scale localized contrast (Top-Hat + DoG) to capture
       nail plates regardless of hand pose, lighting, or skin tone.
    3. Geometric filtering (area, aspect ratio, solidity, boundary check).
    4. Non-maximum suppression to merge overlapping candidate boxes.
    """
    img_h, img_w = img_bgr.shape[:2]
    total_area = img_h * img_w

    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    ycrcb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2YCrCb)
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)

    skin = cv2.bitwise_or(
        cv2.inRange(hsv, (0, 10, 30), (35, 255, 255)),
        cv2.inRange(ycrcb, (0, 125, 70), (255, 185, 140)),
    )

    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    L_chan = lab[:, :, 0]

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    L_enh = clahe.apply(L_chan)
    k_nail = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (max(9, int(img_w * 0.05)) | 1, max(9, int(img_h * 0.05)) | 1))
    tophat = cv2.morphologyEx(L_enh, cv2.MORPH_TOPHAT, k_nail)
    _, th_tophat = cv2.threshold(tophat, 10, 255, cv2.THRESH_BINARY)

    blur_large = cv2.GaussianBlur(gray, (int(img_w * 0.08) | 1, int(img_h * 0.08) | 1), 0)
    diff = cv2.subtract(gray, blur_large)
    _, th_diff = cv2.threshold(diff, 5, 255, cv2.THRESH_BINARY)

    combined = cv2.bitwise_or(th_tophat, th_diff)
    combined = cv2.bitwise_and(combined, skin)

    k_clean = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    clean_mask = cv2.morphologyEx(combined, cv2.MORPH_OPEN, k_clean)
    clean_mask = cv2.morphologyEx(clean_mask, cv2.MORPH_CLOSE, k_clean)

    contours, _ = cv2.findContours(clean_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    raw_candidates = []
    min_area_px = max(config.NAIL_MIN_CONTOUR_AREA_PX, int(total_area * config.NAIL_MIN_CONTOUR_AREA_FRACTION))
    max_area_px = int(total_area * config.NAIL_MAX_CONTOUR_AREA_FRACTION)

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area_px or area > max_area_px:
            continue
        x, y, bw, bh = cv2.boundingRect(cnt)

        # Exclude giant boundary artifacts spanning full top-to-bottom
        if y == 0 and (y + bh) >= (img_h - 2):
            continue
        if (x == 0 or x + bw >= img_w) and y == 0 and area > total_area * 0.04:
            continue

        aspect = bw / (bh + 1e-6)
        if aspect < config.NAIL_MIN_ASPECT_RATIO or aspect > config.NAIL_MAX_ASPECT_RATIO:
            continue
        hull = cv2.convexHull(cnt)
        hull_area = cv2.contourArea(hull)
        solidity = area / (hull_area + 1e-6)
        if solidity < config.NAIL_MIN_SOLIDITY:
            continue

        raw_candidates.append({
            "bbox": (int(x), int(y), int(bw), int(bh)),
            "area": int(area),
            "area_frac": round(area / total_area, 5),
            "aspect": round(aspect, 2),
            "solidity": round(solidity, 2),
            "center": (int(x + bw // 2), int(y + bh // 2)),
        })

    raw_candidates.sort(key=lambda c: c["area"], reverse=True)
    nms_candidates: list[dict[str, Any]] = []

    for cand in raw_candidates:
        cx1, cy1 = cand["center"]
        x1, y1, w1, h1 = cand["bbox"]
        overlap = False
        for kept in nms_candidates:
            cx2, cy2 = kept["center"]
            dist = np.hypot(cx1 - cx2, cy1 - cy2)
            if dist < max(min(w1, h1), 30):
                overlap = True
                break
        if not overlap:
            nms_candidates.append(cand)

    return nms_candidates


def _check_nail_detection(img_bgr: np.ndarray) -> tuple[bool, bool, int, dict[str, Any]]:
    """
    Verifies that AT LEAST 3 clearly visible fingernails are present and sufficiently large.
    Returns:
        (nail_detected, nail_quality_ok, nail_count, meta)
    """
    candidates = _detect_nail_candidates(img_bgr)
    nail_count = len(candidates)
    meta: dict[str, Any] = {
        "nail_count": nail_count,
        "candidates": candidates,
    }

    if nail_count < config.NAIL_MIN_COUNT:
        meta["rejection_reason"] = "NO_NAIL_DETECTED" if nail_count == 0 else "NAILS_TOO_SMALL"
        return False, False, nail_count, meta

    return True, True, nail_count, meta


_NAIL_ERRORS: dict[str, str] = {
    "DECODE_FAILED": "Could not read the image file. Please upload a valid JPEG or PNG.",
    "RESOLUTION_TOO_LOW": f"Image resolution is too low (minimum: {config.MIN_WIDTH}×{config.MIN_HEIGHT} px).",
    "IMAGE_TOO_BLURRY": "Image is too blurry. Hold the camera steady, ensure good lighting, and tap to focus.",
    "IMAGE_TOO_DARK": "Image is too dark. Move to a well-lit area before retaking.",
    "IMAGE_OVEREXPOSED": "Image is overexposed. Avoid direct glare and retake.",
    "NO_NAIL_DETECTED": "Fewer than 3 fingernails detected. Please capture at least 3 clearly visible fingernails.",
    "NAILS_TOO_SMALL": "Fingernails are too small or far away. Move the camera closer to show at least 3 clear fingernails.",
    "NAIL_QUALITY_POOR": "The fingernail regions are unclear. Ensure nails are clean, unpolished, and in-frame.",
}


@router.post(
    "/validate-image-nail",
    response_model=NailValidationResponse,
    summary="Validate a nail-bed image for quality before analysis",
)
@router.post(
    "/validate-nail-image",
    response_model=NailValidationResponse,
    include_in_schema=False,
)
async def validate_image_nail(
    image: UploadFile = File(..., description="Nail-bed image (JPEG/PNG/WebP)"),
) -> NailValidationResponse:
    checks = NailChecksResult()
    errors: list[ValidationError] = []

    try:
        raw_bytes = await image.read()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not read the uploaded file.") from exc

    img_bgr = _decode_image(raw_bytes)
    if img_bgr is None:
        errors.append(ValidationError(code="DECODE_FAILED", message=_NAIL_ERRORS["DECODE_FAILED"]))
        return NailValidationResponse(valid=False, message="Image could not be decoded.", checks=checks, errors=errors, nail_count=0)

    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    res_ok, res_meta = _check_resolution(img_bgr)
    checks.resolution = res_ok
    if not res_ok:
        errors.append(ValidationError(code="RESOLUTION_TOO_LOW", message=_NAIL_ERRORS["RESOLUTION_TOO_LOW"]))

    blur_ok, blur_meta = _check_nail_blur(img_bgr, gray)
    checks.blur = blur_ok
    if not blur_ok:
        errors.append(ValidationError(code="IMAGE_TOO_BLURRY", message=_NAIL_ERRORS["IMAGE_TOO_BLURRY"]))

    bright_ok, bright_meta = _check_brightness(gray)
    checks.brightness = bright_ok
    if not bright_ok:
        code = "IMAGE_OVEREXPOSED" if bright_meta["overexposed"] else "IMAGE_TOO_DARK"
        errors.append(ValidationError(code=code, message=_NAIL_ERRORS[code]))

    try:
        nail_ok, quality_ok, nail_count, nail_meta = _check_nail_detection(img_bgr)
    except Exception as exc:
        logger.exception("Nail detection error: %s", exc)
        nail_ok, quality_ok, nail_count, nail_meta = False, False, 0, {"error": str(exc)}

    checks.nail_detection = nail_ok
    checks.nail_quality = quality_ok

    if not nail_ok:
        rejection = nail_meta.get("rejection_reason", "NO_NAIL_DETECTED")
        err_code = rejection if rejection in _NAIL_ERRORS else "NO_NAIL_DETECTED"
        errors.append(ValidationError(code=err_code, message=_NAIL_ERRORS[err_code]))
    elif not quality_ok:
        rejection = nail_meta.get("rejection_reason", "NAILS_TOO_SMALL")
        err_code = rejection if rejection in _NAIL_ERRORS else "NAILS_TOO_SMALL"
        errors.append(ValidationError(code=err_code, message=_NAIL_ERRORS[err_code]))

    valid = not errors
    msg = f"Nail image passed all quality checks." if valid else f"Nail image failed {len(errors)} quality check(s)."
    return NailValidationResponse(valid=valid, message=msg, checks=checks, errors=errors, nail_count=nail_count)

