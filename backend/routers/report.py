"""
HemoLens Backend — Screening Report Generation Router
=====================================================
POST /api/screen/generate-report
--------------------------------
Generates a personalized, structured educational screening report via Gemini AI.
Consumes trusted backend ML metrics and WHO 2024 classification outputs.
Strictly 1 AI call per report with automatic graceful fallback.
"""

from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, status

try:
    from backend.ai.gemini import (
        ReportGenerationResponse,
        ScreeningReportInput,
        generate_screening_report,
    )
except ModuleNotFoundError:
    from ai.gemini import (
        ReportGenerationResponse,
        ScreeningReportInput,
        generate_screening_report,
    )

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/screen", tags=["reports"])


@router.post(
    "/generate-report",
    response_model=ReportGenerationResponse,
    summary="Generate personalized AI screening report",
    description=(
        "Consumes trusted backend screening results (Hb estimate, range, confidence, risk tier), "
        "demographics, and reported symptoms to produce a structured educational report via Gemini AI. "
        "Never alters backend numerical metrics or clinical thresholds. "
        "Safely returns a structured fallback report if AI service is offline or unconfigured."
    ),
)
async def create_screening_report(
    input_data: ScreeningReportInput,
) -> ReportGenerationResponse:
    try:
        response = generate_screening_report(input_data)
        return response
    except Exception as exc:
        logger.exception("Unexpected error in generate-report endpoint: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "REPORT_GENERATION_FAILED",
                "message": "Failed to process screening report request.",
                "reason": str(exc),
            },
        ) from exc
