"""
HemoLens AI — Gemini Report Generation Schemas
===============================================
Pydantic contracts for structured Gemini AI screening report generation.

Architectural Guarantees:
1. Strict typing and validation for inputs and outputs.
2. Trusted backend numerical values are preserved and immutable.
3. No raw image data, auth tokens, or sensitive PII are present in schemas.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field


class ReportGenerationStatus(str, Enum):
    COMPLETE = "complete"
    FALLBACK = "fallback"
    UNAVAILABLE = "unavailable"
    FAILED = "failed"


# ---------------------------------------------------------------------------
# Input Schemas (Trusted Backend Data Provided to AI)
# ---------------------------------------------------------------------------

class MLScreeningContext(BaseModel):
    """Immutable ML prediction and deterministic clinical classification output."""
    model_config = ConfigDict(frozen=True)

    hb_estimate: float = Field(..., description="Continuous Hb estimate from ML model in g/dL")
    hb_range: list[float] = Field(..., description="Calibrated uncertainty interval [lower, upper] in g/dL")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model confidence score (0.0 - 1.0)")
    risk_category: str = Field(..., description="Anaemia risk tier: normal | mild | moderate | severe | unclassifiable")
    applicable_reference_population: str = Field(..., description="WHO population reference applied")
    threshold_version: str = Field(default="who_2024_hb_v1", description="WHO guideline version")
    reference_source: str = Field(
        default="WHO 2024 Guideline on Haemoglobin Cutoffs for Anaemia",
        description="Clinical reference document"
    )
    thresholds_applied: Optional[dict[str, float]] = Field(
        default=None,
        description="Exact numerical cutoffs applied for classification"
    )
    model_version: str = Field(default="eyelid_hb_model_v1", description="ML model bundle identifier")
    unclassifiable_reason: Optional[str] = Field(
        default=None,
        description="Reason why classification could not be performed if unclassifiable"
    )


class UserHealthProfileContext(BaseModel):
    """Anonymized user health demographics relevant for report personalization."""
    model_config = ConfigDict(frozen=True)

    age: Optional[int] = Field(default=None, ge=0, description="User age in years")
    gender: Optional[str] = Field(default=None, description="Biological sex")
    pregnancy_status: Optional[str] = Field(default=None, description="Pregnancy status if applicable")
    diet: Optional[str] = Field(default=None, description="Self-reported dietary pattern (e.g. Vegetarian, Omnivore, Vegan)")
    previous_anemia_history: Optional[str] = Field(default=None, description="History of diagnosed anemia or iron deficiency")
    medical_conditions: Optional[list[str]] = Field(default=None, description="Relevant diagnosed chronic medical conditions")


class SymptomsContext(BaseModel):
    """User-reported clinical symptoms."""
    model_config = ConfigDict(frozen=True)

    fatigue: bool = Field(default=False, description="Persistent fatigue or exhaustion")
    weakness: bool = Field(default=False, description="Generalized muscle weakness")
    dizziness: bool = Field(default=False, description="Lightheadedness or dizziness")
    pale_skin: bool = Field(default=False, description="Noticeable skin or mucosal pallor")
    shortness_of_breath: bool = Field(default=False, description="Dyspnea / shortness of breath during exertion")
    cold_hands_feet: bool = Field(default=False, description="Cold extremities")
    headaches: bool = Field(default=False, description="Frequent headaches")
    brittle_nails: bool = Field(default=False, description="Brittle or spoon-shaped nails (koilonychia)")
    chest_pain: bool = Field(default=False, description="Chest discomfort or palpitations")
    other_symptoms: list[str] = Field(default_factory=list, description="Any additional user-specified symptoms")


class ScreeningReportInput(BaseModel):
    """Complete trusted input package required to generate an educational screening report."""
    screening_id: str = Field(..., description="Unique screening session identifier")
    ml_result: MLScreeningContext = Field(..., description="Verified ML and clinical classification results")
    user_profile: UserHealthProfileContext = Field(default_factory=UserHealthProfileContext, description="User health demographics")
    symptoms: SymptomsContext = Field(default_factory=SymptomsContext, description="Current reported symptoms")
    language: str = Field(default="en", description="Target language code for the report narrative ('en' | 'hi')")


# ---------------------------------------------------------------------------
# Output Schemas (Structured Report Generated for Frontend UI)
# ---------------------------------------------------------------------------

class ScreeningReportData(BaseModel):
    """
    Structured clinical educational report conforming to HemoLens UI requirements.
    Numerical metrics and risk categories are strictly anchored to backend truths.
    """
    overall_hb_level: float = Field(..., description="Estimated Hemoglobin level in g/dL (sourced from backend)")
    hb_range: list[float] = Field(..., description="Calibrated uncertainty range [lower, upper] in g/dL")
    risk_category: str = Field(..., description="Anaemia risk tier: normal | mild | moderate | severe | unclassifiable")
    confidence: float = Field(..., description="Model confidence score between 0.0 and 1.0")
    
    summary: str = Field(
        ...,
        description="Executive 2-3 sentence overview explaining the screening estimate and overall takeaway."
    )
    result_explanation: str = Field(
        ...,
        description="Clear, compassionate explanation of what the conjunctival tissue color and Hb estimate indicate."
    )
    factors_considered: list[str] = Field(
        ...,
        description="List of key factors analyzed (e.g., 'Palpebral conjunctival microvascular pallor', 'Self-reported fatigue', 'Diet pattern')."
    )
    symptoms_considered: list[str] = Field(
        ...,
        description="List of user symptoms reviewed in context (e.g., 'Fatigue', 'Dizziness', 'Cold hands & feet')."
    )
    health_profile_summary: str = Field(
        ...,
        description="Brief summary of how the user's demographic and health background context relates to anemia risk."
    )
    recommended_next_steps: list[str] = Field(
        ...,
        description="Actionable next steps emphasizing clinical consultation and dietary/lifestyle awareness."
    )
    confirmatory_testing_recommendation: str = Field(
        ...,
        description="Specific medical guidance advising a laboratory Complete Blood Count (CBC) test with a physician."
    )
    disclaimer: str = Field(
        default=(
            "This is an AI-powered preliminary screening estimate, not a clinical diagnosis. "
            "Do not start, stop, or change any medication or supplement without consulting a qualified physician. "
            "Anemia must be confirmed through a certified laboratory venous blood test (Complete Blood Count)."
        ),
        description="Mandatory medical non-diagnostic disclaimer."
    )


class ReportGenerationResponse(BaseModel):
    """Top-level API response from the report generation service."""
    screening_id: str = Field(..., description="Screening ID for which the report was generated")
    status: ReportGenerationStatus = Field(..., description="Report generation status: complete | fallback | unavailable | failed")
    report: ScreeningReportData = Field(..., description="Structured screening report data")
    generated_at: str = Field(..., description="ISO 8601 UTC timestamp of report generation")
    llm_model: Optional[str] = Field(None, description="Name of LLM model utilized (e.g. gemini-2.5-flash) or None if fallback")
    error_message: Optional[str] = Field(None, description="Diagnostic error description if LLM failed or was unavailable")
