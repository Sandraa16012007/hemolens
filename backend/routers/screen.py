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
    """Variance of Laplacian blur detection. Higher variance = sharper image."""
    variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    passed = variance >= config.BLUR_THRESHOLD
    return passed, {"laplacian_variance": round(variance, 2)}


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
    Fallback check for macro / close-up eyelid images where full face geometry
    is cropped out, preventing MediaPipe BlazeFace from detecting standard face landmarks.

    Evaluates:
      1. Biological ocular/skin tissue dominance (R > G & R > B).
      2. Mucosal / pink-red conjunctiva tissue presence in HSV color space.
      3. Texture and gradient complexity to distinguish real ocular tissue from solid colors.
    """
    img_h, img_w = img_rgb.shape[:2]
    total_pixels = img_h * img_w

    r = img_rgb[:, :, 0].astype(int)
    g = img_rgb[:, :, 1].astype(int)
    b = img_rgb[:, :, 2].astype(int)

    # Biological tissue / skin / mucosa channel dominance
    tissue_mask = (r > g) & (r > b) & (r > 30)
    tissue_fraction = float(np.count_nonzero(tissue_mask) / total_pixels)

    # HSV color analysis for pink/red mucosal tissue & sclera
    hsv = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2HSV)
    mask_red1 = cv2.inRange(hsv, np.array([0, 25, 30]), np.array([20, 255, 255]))
    mask_red2 = cv2.inRange(hsv, np.array([155, 25, 30]), np.array([180, 255, 255]))
    conjunctiva_mask = mask_red1 | mask_red2
    conjunctiva_fraction = float(np.count_nonzero(conjunctiva_mask) / total_pixels)

    gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    texture_std = float(np.std(gray))

    has_tissue = tissue_fraction >= 0.35
    has_conjunctiva = conjunctiva_fraction >= config.MIN_CLOSEUP_CONJUNCTIVA_FRACTION
    has_texture = texture_std >= 12.0

    is_closeup_eye = (has_tissue or has_conjunctiva) and has_texture

    meta = {
        "detection_mode": "macro_closeup",
        "tissue_fraction": round(tissue_fraction, 4),
        "conjunctiva_fraction": round(conjunctiva_fraction, 4),
        "texture_std": round(texture_std, 2),
        "is_closeup_eye": is_closeup_eye,
    }

    if is_closeup_eye:
        return True, True, meta
    return False, False, meta


def _check_eye_and_eyelid(
    img_rgb: np.ndarray,
) -> tuple[bool, bool, dict[str, Any]]:
    """
    Run MediaPipe Face Landmarker (or fallback close-up detector) and evaluate:
      1. eye_detection  — face/eye found and spans enough of the frame.
      2. eyelid_visibility — eye openness (EAR) and lower-eyelid landmark spread.

    Returns (eye_detected: bool, eyelid_visible: bool, meta: dict)
    """
    if not _LANDMARKER_READY or _landmarker is None:
        # Fallback to close-up detector if landmarker unavailable
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

    eye_detected = eye_region_fraction >= config.MIN_EYE_REGION_FRACTION

    if not eye_detected:
        # Check if macro fallback succeeds before rejecting
        c_eye, c_lid, c_meta = _check_closeup_eyelid(img_rgb)
        if c_eye:
            return c_eye, c_lid, c_meta

        return False, False, {
            "face_detected": True,
            "eye_region_fraction": round(eye_region_fraction, 3),
            "min_required": config.MIN_EYE_REGION_FRACTION,
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
    "EYELID_NOT_VISIBLE":
        "The lower eyelid conjunctiva is not sufficiently exposed. Gently "
        "pull your lower eyelid downward until the pink tissue is clearly "
        "visible, then retake.",
}


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post(
    "/validate-image",
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
async def validate_image(
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
        errors.append(ValidationError(code="EYE_NOT_DETECTED", message=_ERRORS["EYE_NOT_DETECTED"]))
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
