"""
HemoLens AI — Gemini Module Package
===================================
Canonical interface for Gemini report generation.
"""

from .client import (
    get_gemini_client,
    get_gemini_model_name,
    is_gemini_configured,
    reset_gemini_client,
)
from .report_generator import generate_screening_report
from .schemas import (
    MLScreeningContext,
    ReportGenerationResponse,
    ReportGenerationStatus,
    ScreeningReportData,
    ScreeningReportInput,
    SymptomsContext,
    UserHealthProfileContext,
)

__all__ = [
    "get_gemini_client",
    "get_gemini_model_name",
    "is_gemini_configured",
    "reset_gemini_client",
    "generate_screening_report",
    "MLScreeningContext",
    "ReportGenerationResponse",
    "ReportGenerationStatus",
    "ScreeningReportData",
    "ScreeningReportInput",
    "SymptomsContext",
    "UserHealthProfileContext",
]
