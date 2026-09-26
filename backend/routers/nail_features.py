"""
HemoLens Backend — POST /api/screen/extract-nail-features
==========================================================
Nail-bed counterpart to `features.py` (eyelid extraction).

- Input: nail image that ALREADY passed `POST /api/screen/validate-image-nail`
  (multipart file "image"). No validation thresholds are re-run here.
- Output: deterministic aggregated 21-dim RGB percentile vector
  (`nail_rgb_v1`) + per-nail descriptors + ROI metadata + image references.

Does NOT modify validation (`screen.py`), the eyelid pipeline, the eyelid
ML schema/predictor, auth, DB, or report layout. OpenCV + numpy only.

Image handling mirrors the eyelid endpoint:
- Original preserved unchanged; separate ROI-marked copy with numbered
  nail boxes + inner-60% rects.
- Files saved to backend/storage/nail_features/<uuid>/.
- Always HTTP 200 with success bool; never fabricates features.
"""

from __future__ import annotations

import logging
import uuid
from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/screen", tags=["screening"])


# ---------------------------------------------------------------------------
# Lazy import of core logic (keeps router import light, mirrors features.py)
# ---------------------------------------------------------------------------


def _get_core():
    try:
        from backend.cv.nail_features import extract_nail_features, FEATURE_NAMES
    except ModuleNotFoundError:
        from cv.nail_features import extract_nail_features, FEATURE_NAMES  # type: ignore[no-redef]
    return extract_nail_features, FEATURE_NAMES


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post(
    "/extract-nail-features",
    summary="Extract nail-bed RGB optical features (nail_rgb_v1)",
    description=(
        "Accepts a validated nail-bed image (must already have passed "
        "POST /api/screen/validate-image-nail) and returns a deterministic "
        "21-dim aggregated RGB percentile vector (7 percentiles x R/G/B) "
        "computed on inner-60% nail-plate regions after white-reference "
        "normalization, plus per-nail descriptors and a numbered "
        "ROI-marked image. Never fabricates features on invalid ROI. "
        "Not connected to Hb prediction."
    ),
)
async def extract_nail_features_endpoint(
    image: UploadFile = File(..., description="Validated nail-bed image (JPEG/PNG/WebP)"),
    screening_id: Optional[str] = Form(None, description="Optional screening/session identifier"),
) -> dict:
    extract_fn, feature_names = _get_core()

    try:
        raw_bytes = await image.read()
    except Exception as exc:
        logger.exception(f"Failed to read uploaded file: {exc}")
        return {
            "success": False,
            "error": "READ_FAILED",
            "reason": "Could not read uploaded file.",
            "roi": None,
            "feature_vector": [],
            "feature_names": feature_names,
            "nail_count": 0,
            "per_nail_features": [],
        }

    if not raw_bytes or len(raw_bytes) < 100:
        return {
            "success": False,
            "error": "EMPTY_FILE",
            "reason": "Uploaded file is empty or too small.",
            "roi": None,
            "feature_vector": [],
            "feature_names": feature_names,
            "nail_count": 0,
            "per_nail_features": [],
        }

    sid = screening_id or uuid.uuid4().hex[:12]
    result = extract_fn(raw_bytes, screening_id=sid)

    if result.get("success"):
        logger.info(
            "extract-nail-features | success | nails=%s features=%d",
            result.get("nail_count"),
            len(result.get("feature_vector", [])),
        )
    else:
        logger.info(
            "extract-nail-features | failure | error=%s reason=%s",
            result.get("error"),
            result.get("reason"),
        )

    return result
