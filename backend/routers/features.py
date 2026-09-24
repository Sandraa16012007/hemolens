"""
HemoLens Backend — POST /api/screen/extract-eyelid-features
=============================================================
Phase 2: Palpebral conjunctiva feature extraction (isolated).

- Input: already-verified eyelid image (multipart file "image")
- Also accepts optional passthrough references for nail-bed images:
    nailbed_original_reference, nailbed_roi_reference (form fields or query)
  These are NOT processed; they are echoed back so the report can render:
    Original Eyelid -> ROI-Marked Eyelid
    Original Nail   -> ROI-Marked Nail
- Output: deterministic 49-dim feature vector + ROI bbox + image references.

Does NOT modify validation, ML, LLM, auth, DB, or report redesign.
Uses only allowed deps: fastapi, opencv-headless, numpy, mediapipe.

Image handling:
- Original is preserved unchanged; saves separate ROI-marked copy with
  translucent mask + outline.
- Files saved to backend/storage/eyelid_features/<uuid>/
- In production, these could be uploaded to Supabase storage; here we
  return filesystem references (minimal plumbing).

Returns always HTTP 200 with success bool; never fabricates features.
"""

from __future__ import annotations

import logging
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, UploadFile, Form
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/screen", tags=["screening"])

# ---------------------------------------------------------------------------
# Response schemas (isolated, not touching validation schemas)
# ---------------------------------------------------------------------------

class RoiInfo(BaseModel):
    x: int
    y: int
    width: int
    height: int
    pixel_count: int

class EyelidFeaturesSuccessResponse(BaseModel):
    success: bool = True
    feature_vector: list[float]
    feature_names: list[str]
    roi: RoiInfo
    original_image_reference: str
    roi_marked_image_reference: str
    # Passthrough nail references (if provided, echoed)
    nailbed_original_reference: Optional[str] = None
    nailbed_roi_reference: Optional[str] = None
    meta: Optional[dict] = None

class EyelidFeaturesFailureResponse(BaseModel):
    success: bool = False
    error: str
    reason: str
    roi: Optional[RoiInfo] = None
    feature_vector: list[float] = []
    feature_names: list[str] = []
    # Passthrough preserved even on failure
    nailbed_original_reference: Optional[str] = None
    nailbed_roi_reference: Optional[str] = None
    meta: Optional[dict] = None

# ---------------------------------------------------------------------------
# Lazy import of core logic (keeps router import light)
# ---------------------------------------------------------------------------

def _get_core():
    try:
        from backend.cv.eyelid_features import extract_eyelid_features, FEATURE_NAMES
    except ModuleNotFoundError:
        from cv.eyelid_features import extract_eyelid_features, FEATURE_NAMES
    return extract_eyelid_features, FEATURE_NAMES

# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post(
    "/extract-eyelid-features",
    summary="Extract palpebral conjunctiva color features (Phase 2)",
    description=(
        "Accepts a verified lower-eyelid image and returns a deterministic "
        "49-dim handcrafted feature vector (RGB/HSV/CIELAB + redness proxies) "
        "computed only on the detected conjunctival ROI. "
        "Uses triangle thresholding + entropy/grayscale processing per CP-AnemiC, "
        "LAB CLAHE illumination normalization, and preserves original image "
        "while saving a separate ROI-marked copy. "
        "Optional nailbed references are passed through for report plumbing. "
        "Never fabricates features on invalid ROI."
    ),
)
async def extract_eyelid_features_endpoint(
    image: UploadFile = File(..., description="Verified lower-eyelid image (JPEG/PNG/WebP)"),
    nailbed_original_reference: Optional[str] = Form(None, description="Passthrough: original nail-bed image reference"),
    nailbed_roi_reference: Optional[str] = Form(None, description="Passthrough: ROI-marked nail-bed image reference"),
) -> dict:
    extract_fn, feature_names = _get_core()

    # Read bytes
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
            "nailbed_original_reference": nailbed_original_reference,
            "nailbed_roi_reference": nailbed_roi_reference,
        }

    if not raw_bytes or len(raw_bytes) < 100:
        return {
            "success": False,
            "error": "EMPTY_FILE",
            "reason": "Uploaded file is empty or too small.",
            "roi": None,
            "feature_vector": [],
            "feature_names": feature_names,
            "nailbed_original_reference": nailbed_original_reference,
            "nailbed_roi_reference": nailbed_roi_reference,
        }

    # Generate screening id for storage grouping
    screening_id = uuid.uuid4().hex[:12]

    result = extract_fn(raw_bytes, screening_id=screening_id)

    # Attach passthrough nail references
    result["nailbed_original_reference"] = nailbed_original_reference
    result["nailbed_roi_reference"] = nailbed_roi_reference

    # Ensure response matches expected schema structure
    if result.get("success"):
        # Validate finite/fixed length already done in core
        logger.info(
            "extract-eyelid-features | success | roi=%s pixel_count=%s features=%d",
            result.get("roi"),
            result.get("roi", {}).get("pixel_count"),
            len(result.get("feature_vector", [])),
        )
    else:
        logger.info(
            "extract-eyelid-features | failure | error=%s reason=%s",
            result.get("error"),
            result.get("reason"),
        )

    return result


# ---------------------------------------------------------------------------
# Additional endpoint: JSON passthrough for report plumbing
# Provides minimal data plumbing for frontend report to fetch 4-image structure.
# ---------------------------------------------------------------------------

class ReportImageRefs(BaseModel):
    eyelid_original: Optional[str] = None
    eyelid_roi_marked: Optional[str] = None
    nailbed_original: Optional[str] = None
    nailbed_roi_marked: Optional[str] = None

@router.get(
    "/report-image-refs/{screening_id}",
    summary="Get image references for report (plumbing)",
    description=(
        "Minimal plumbing to support report's 4-image structure: "
        "Original Eyelid -> ROI-Marked Eyelid, Original Nail -> ROI-Marked Nail. "
        "This endpoint simply echoes stored references; it does NOT re-run extraction."
    ),
)
async def get_report_image_refs(screening_id: str) -> dict:
    """
    Minimal placeholder: in Phase 2, image refs are filesystem paths.
    In production with Supabase, this would query DB for screening record.
    Kept isolated and trivial to avoid DB/auth changes.
    """
    # Check if local storage exists for this screening_id
    try:
        from pathlib import Path as _P
        base = _P(__file__).parent.parent / "storage" / "eyelid_features" / screening_id
        eyelid_orig = str(base / "eyelid_original.jpg") if (base / "eyelid_original.jpg").exists() else None
        eyelid_marked = str(base / "eyelid_roi_marked.jpg") if (base / "eyelid_roi_marked.jpg").exists() else None
    except Exception:
        eyelid_orig, eyelid_marked = None, None

    return {
        "screening_id": screening_id,
        "eyelid_original_reference": eyelid_orig,
        "eyelid_roi_marked_reference": eyelid_marked,
        "nailbed_original_reference": None,  # teammate will populate
        "nailbed_roi_reference": None,
        "structure": [
            "Original Eyelid Image",
            "ROI-Marked Eyelid Image",
            "Original Nail-Bed Image",
            "ROI-Marked Nail-Bed Image",
        ],
    }
