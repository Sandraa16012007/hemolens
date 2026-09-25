"""
HemoLens Backend — Canonical Screening Analysis Router
======================================================
POST /api/screen/analyze
------------------------
Unified screening analysis pipeline:
  1. Receive image + demographic context (age, gender, pregnancy_status).
  2. Validate image quality (resolution, blur, brightness, MediaPipe eye detection).
  3. Extract palpebral conjunctiva ROI and 49-dimensional color/texture feature vector.
  4. Run ML inference for continuous hemoglobin estimation with calibrated uncertainty.
  5. Run deterministic WHO 2024 clinical Hb classification.
  6. Return structured screening response without dynamic LLM modifications.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import cv2
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

try:
    from backend.clinical.risk_classifier import (
        ClassificationResult,
        ThresholdInfo,
        UserProfileContext,
        classify_anaemia_risk,
    )
    from backend.cv.eyelid_features import extract_eyelid_features
    from backend.ml.predictor import predict_hb
    from backend.routers.screen import (
        ChecksResult,
        ValidationError,
        _check_brightness,
        _check_blur,
        _check_eye_and_eyelid,
        _check_resolution,
        _decode_image,
        _ERRORS,
    )
except ModuleNotFoundError:
    from clinical.risk_classifier import (
        ClassificationResult,
        ThresholdInfo,
        UserProfileContext,
        classify_anaemia_risk,
    )
    from cv.eyelid_features import extract_eyelid_features
    from ml.predictor import predict_hb
    from routers.screen import (
        ChecksResult,
        ValidationError,
        _check_brightness,
        _check_blur,
        _check_eye_and_eyelid,
        _check_resolution,
        _decode_image,
        _ERRORS,
    )

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/screen", tags=["screening"])


# ---------------------------------------------------------------------------
# Response Schemas
# ---------------------------------------------------------------------------

class RoiInfo(BaseModel):
    x: int = Field(..., description="Top-left X coordinate of bounding box")
    y: int = Field(..., description="Top-left Y coordinate of bounding box")
    width: int = Field(..., description="Width of bounding box in pixels")
    height: int = Field(..., description="Height of bounding box in pixels")
    pixel_count: int = Field(..., description="Count of segmented conjunctival pixels")


class ScreeningAnalysisResponse(BaseModel):
    """
    Canonical response schema for HemoLens screening analysis.
    Contains ML prediction and deterministic clinical classification.
    """
    screening_id: str = Field(..., description="Unique screening identifier")
    status: str = Field(default="complete", description="Analysis status: complete | failed | partial")
    analysis_timestamp: str = Field(..., description="ISO 8601 UTC timestamp of analysis")
    
    # ML Inference Results
    hb_estimate: float = Field(..., description="Estimated Hemoglobin level in g/dL")
    hb_range: list[float] = Field(..., description="Calibrated uncertainty interval [lower, upper] in g/dL")
    model_confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score between 0.0 and 1.0")
    model_version: str = Field(..., description="Version of the ML model used for inference")
    
    # Clinical Classification Results
    risk_category: str = Field(..., description="Anaemia risk tier: normal | mild | moderate | severe | unclassifiable")
    applicable_reference_population: str = Field(..., description="WHO population group applied for classification")
    threshold_version: str = Field(..., description="Clinical threshold schema version")
    reference_source: str = Field(..., description="Authoritative clinical guidance reference")
    thresholds_applied: Optional[ThresholdInfo] = Field(None, description="Exact cutoffs applied if classified")
    unclassifiable_reason: Optional[str] = Field(None, description="Explanation when category is unclassifiable")
    disclaimer: str = Field(..., description="Medical disclaimer for non-diagnostic preliminary screening")
    
    # Visual / Feature Metadata
    roi_info: Optional[RoiInfo] = Field(None, description="Bounding box and pixel metadata of segmented ROI")
    roi_marked_image_base64: Optional[str] = Field(None, description="Base64-encoded image with ROI overlay for UI inspection")


# ---------------------------------------------------------------------------
# Endpoint: POST /api/screen/analyze
# ---------------------------------------------------------------------------

@router.post(
    "/analyze",
    response_model=ScreeningAnalysisResponse,
    summary="Run full end-to-end eyelid screening analysis",
    description=(
        "Executes the full HemoLens screening pipeline: "
        "1. Image quality validation (resolution, blur, brightness, MediaPipe eye detection)\n"
        "2. Conjunctival ROI detection and 49-feature extraction\n"
        "3. ML Hemoglobin regression inference\n"
        "4. Deterministic WHO clinical risk classification\n"
        "Returns a structured screening result object."
    ),
    responses={
        200: {"description": "Screening analysis completed successfully."},
        400: {"description": "Invalid image file or failed image quality validation."},
        422: {"description": "Eyelid ROI detection or feature extraction failure."},
        500: {"description": "Internal error during ML inference or processing."},
    },
)
async def analyze_eyelid_screening(
    image: UploadFile = File(..., description="Eyelid photograph (JPEG/PNG/WebP)"),
    user_age: Optional[int] = Form(None, ge=0, description="User age in years"),
    user_gender: Optional[str] = Form(None, description="User biological sex (Female/Male/Other/Prefer not to say)"),
    pregnancy_status: Optional[str] = Form(None, description="Pregnancy status (Pregnant/Not pregnant/Not applicable)"),
    screening_id: Optional[str] = Form(None, description="Optional screening identifier UUID"),
    skip_validation: bool = Form(False, description="Whether to bypass quality checks (e.g. if already validated)"),
) -> ScreeningAnalysisResponse:
    active_screening_id = screening_id or str(uuid.uuid4())

    # ------------------------------------------------------------------ #
    # Step 1 — Read & Decode Image                                        #
    # ------------------------------------------------------------------ #
    try:
        raw_bytes = await image.read()
    except Exception as exc:
        logger.exception("Failed reading uploaded file: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "READ_FAILED", "message": "Could not read uploaded image data."},
        ) from exc

    if not raw_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "EMPTY_FILE", "message": "Uploaded image file is empty."},
        )

    img_bgr = _decode_image(raw_bytes)
    if img_bgr is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "DECODE_FAILED", "message": _ERRORS["DECODE_FAILED"]},
        )

    # ------------------------------------------------------------------ #
    # Step 2 — Image Quality Validation (unless explicitly bypassed)     #
    # ------------------------------------------------------------------ #
    if not skip_validation:
        checks = ChecksResult()
        errors: list[ValidationError] = []

        # Resolution
        res_ok, _ = _check_resolution(img_bgr)
        checks.resolution = res_ok
        if not res_ok:
            errors.append(ValidationError(code="RESOLUTION_TOO_LOW", message=_ERRORS["RESOLUTION_TOO_LOW"]))

        # Blur
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        blur_ok, _ = _check_blur(gray)
        checks.blur = blur_ok
        if not blur_ok:
            errors.append(ValidationError(code="IMAGE_TOO_BLURRY", message=_ERRORS["IMAGE_TOO_BLURRY"]))

        # Brightness / Exposure
        bright_ok, bright_meta = _check_brightness(gray)
        checks.brightness = bright_ok
        if not bright_ok:
            code = "IMAGE_OVEREXPOSED" if bright_meta["overexposed"] else "IMAGE_TOO_DARK"
            errors.append(ValidationError(code=code, message=_ERRORS[code]))

        # MediaPipe Face & Eye Landmark Detection
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        try:
            eye_ok, eyelid_ok, mesh_meta = _check_eye_and_eyelid(img_rgb)
        except Exception as exc:
            logger.exception("MediaPipe FaceLandmarker error during screening: %s", exc)
            eye_ok, eyelid_ok, mesh_meta = False, False, {"error": str(exc)}

        checks.eye_detection = eye_ok
        checks.eyelid_visibility = eyelid_ok

        if not eye_ok:
            err_code = mesh_meta.get("framing_error", "EYE_NOT_DETECTED")
            errors.append(ValidationError(code=err_code, message=_ERRORS.get(err_code, _ERRORS["EYE_NOT_DETECTED"])))
        elif not eyelid_ok:
            errors.append(ValidationError(code="EYELID_NOT_VISIBLE", message=_ERRORS["EYELID_NOT_VISIBLE"]))

        if errors:
            logger.info("Screening validation failed for screening %s: %d errors", active_screening_id, len(errors))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "VALIDATION_FAILED",
                    "message": "Image quality validation failed. Please retake the image following the guidance.",
                    "checks": checks.model_dump(),
                    "errors": [err.model_dump() for err in errors],
                },
            )

    # ------------------------------------------------------------------ #
    # Step 3 — ROI Detection & Feature Extraction                         #
    # ------------------------------------------------------------------ #
    try:
        extract_res = extract_eyelid_features(
            raw_bytes=raw_bytes,
            screening_id=active_screening_id,
            save_images=False,
        )
    except Exception as exc:
        logger.exception("Unexpected exception in feature extraction: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "FEATURE_EXTRACTION_CRASH",
                "message": "An unexpected error occurred while analyzing the eyelid image.",
                "reason": str(exc),
            },
        ) from exc

    if not extract_res.get("success", False):
        err_code = extract_res.get("error", "EXTRACTION_FAILED")
        reason = extract_res.get("reason", "Could not locate palpebral conjunctiva region.")
        logger.warning("Feature extraction failed for %s: %s - %s", active_screening_id, err_code, reason)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": err_code,
                "message": "Failed to extract features from conjunctiva region.",
                "reason": reason,
            },
        )

    feature_vector = extract_res.get("feature_vector", [])
    roi_dict = extract_res.get("roi")
    roi_info = RoiInfo(**roi_dict) if roi_dict else None
    roi_marked_base64 = extract_res.get("roi_marked_image_base64")

    # ------------------------------------------------------------------ #
    # Step 4 — ML Hemoglobin Prediction                                  #
    # ------------------------------------------------------------------ #
    try:
        prediction = predict_hb(feature_vector)
    except Exception as exc:
        logger.exception("ML inference failed for screening %s: %s", active_screening_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "INFERENCE_FAILED",
                "message": "Hemoglobin estimation inference failed.",
                "reason": str(exc),
            },
        ) from exc

    # ------------------------------------------------------------------ #
    # Step 5 — Deterministic Clinical Classification                      #
    # ------------------------------------------------------------------ #
    user_context = UserProfileContext(
        age=user_age,
        gender=user_gender,
        pregnancy_status=pregnancy_status,
    )

    classification: ClassificationResult = classify_anaemia_risk(
        hb_estimate=prediction.hb_estimate,
        hb_range=prediction.hb_range,
        context=user_context,
    )

    now_iso = datetime.now(timezone.utc).isoformat()

    # ------------------------------------------------------------------ #
    # Step 6 — Build & Return Structured Response                         #
    # ------------------------------------------------------------------ #
    return ScreeningAnalysisResponse(
        screening_id=active_screening_id,
        status="complete",
        analysis_timestamp=now_iso,
        hb_estimate=prediction.hb_estimate,
        hb_range=prediction.hb_range,
        model_confidence=prediction.confidence,
        model_version=prediction.model_version,
        risk_category=classification.risk_category.value,
        applicable_reference_population=classification.applicable_population,
        threshold_version=classification.threshold_version,
        reference_source=classification.reference_source,
        thresholds_applied=classification.thresholds_applied,
        unclassifiable_reason=classification.unclassifiable_reason,
        disclaimer=classification.disclaimer,
        roi_info=roi_info,
        roi_marked_image_base64=roi_marked_base64 if roi_marked_base64 else None,
    )
