"""
HemoLens Clinical — Risk Classifier
=====================================
Deterministic anaemia risk classification using WHO 2024 haemoglobin cutoffs.

Responsibilities:
  1. Accept a user profile (age, sex, pregnancy_status) and an Hb estimate.
  2. Resolve the applicable WHO population group and threshold set.
  3. Classify the Hb estimate into one of four tiers: normal / mild / moderate / severe.
  4. Return a fully structured ClassificationResult.

Contract guarantees:
  - Pure function: same inputs → same output, always.
  - Never silently invents a population group or modifies thresholds.
  - Explicitly returns UNCLASSIFIABLE for ambiguous/unsupported profiles.
  - Gemini is never involved in numerical classification.
"""

from __future__ import annotations

import logging
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

try:
    from backend.clinical.anemia_thresholds import (
        HbThresholdSet,
        THRESHOLD_SCHEMA_VERSION,
        REFERENCE_SOURCE,
        WHO_CHILD_6_59M,
        WHO_CHILD_5_11Y,
        WHO_CHILD_12_14Y,
        WHO_NON_PREGNANT_WOMEN,
        WHO_PREGNANT_WOMEN,
        WHO_MEN,
    )
except ModuleNotFoundError:
    from clinical.anemia_thresholds import (
        HbThresholdSet,
        THRESHOLD_SCHEMA_VERSION,
        REFERENCE_SOURCE,
        WHO_CHILD_6_59M,
        WHO_CHILD_5_11Y,
        WHO_CHILD_12_14Y,
        WHO_NON_PREGNANT_WOMEN,
        WHO_PREGNANT_WOMEN,
        WHO_MEN,
    )

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Risk tier enumeration
# ---------------------------------------------------------------------------

class RiskCategory(str, Enum):
    NORMAL = "normal"
    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"
    UNCLASSIFIABLE = "unclassifiable"


# ---------------------------------------------------------------------------
# Classification result schema
# ---------------------------------------------------------------------------

class ThresholdInfo(BaseModel):
    """The specific threshold values applied during classification."""
    model_config = ConfigDict(frozen=True)

    normal_cutoff: float = Field(description="Hb (g/dL) at or above which no anaemia is classified.")
    mild_floor: float = Field(description="Lower Hb boundary for mild anaemia tier.")
    moderate_floor: float = Field(description="Lower Hb boundary for moderate anaemia tier; below → severe.")


class ClassificationResult(BaseModel):
    """
    Deterministic anaemia screening classification result.
    This is a screening tool result, NOT a clinical diagnosis.
    """
    model_config = ConfigDict(frozen=True)

    # Core outputs
    risk_category: RiskCategory = Field(
        description="Estimated anaemia risk tier based on WHO haemoglobin cutoffs."
    )
    hb_estimate: float = Field(
        description="Continuous Hb estimate from the ML model (g/dL)."
    )
    hb_range: list[float] = Field(
        description="Calibrated Hb uncertainty interval [lower, upper] in g/dL."
    )

    # Population & classification context
    applicable_population: str = Field(
        description="WHO population group the thresholds were applied to."
    )
    threshold_version: str = Field(
        description="Versioned threshold schema identifier."
    )
    reference_source: str = Field(
        description="Authoritative clinical reference used for threshold values."
    )
    thresholds_applied: Optional[ThresholdInfo] = Field(
        default=None,
        description="Exact threshold values applied. None when UNCLASSIFIABLE.",
    )

    # Unclassifiable reason (present only when risk_category = UNCLASSIFIABLE)
    unclassifiable_reason: Optional[str] = Field(
        default=None,
        description="Explains why classification could not be performed.",
    )

    # Safety disclaimer always present
    disclaimer: str = Field(
        default=(
            "This is a preliminary screening estimate, not a clinical diagnosis. "
            "Confirm results with a certified laboratory Hb test and consult a healthcare provider."
        )
    )


# ---------------------------------------------------------------------------
# Population context input
# ---------------------------------------------------------------------------

class UserProfileContext(BaseModel):
    """
    Minimal demographic context needed for WHO population group selection.
    Sourced from the HemoLens onboarding user_profiles table.

    Supported sex values (matching BiologicalGender in database.types.ts):
        "Female" | "Male" | "Other" | "Prefer not to say"

    Supported pregnancy_status values (matching PregnancyStatus):
        "Not applicable" | "Pregnant" | "Not pregnant"
    """
    model_config = ConfigDict(frozen=True)

    age: Optional[int] = Field(
        default=None,
        ge=0,
        description="User age in years. Required for WHO age-group selection.",
    )
    gender: Optional[str] = Field(
        default=None,
        description=(
            "Biological sex for WHO classification. "
            "Accepts: 'Female', 'Male', 'Other', 'Prefer not to say'. "
            "Non-binary / undisclosed sex will result in UNCLASSIFIABLE."
        ),
    )
    pregnancy_status: Optional[str] = Field(
        default=None,
        description=(
            "Pregnancy status from onboarding. "
            "Accepts: 'Pregnant', 'Not pregnant', 'Not applicable'. "
            "Note: Trimester is not collected; pregnancy uses a single WHO cutoff."
        ),
    )


# ---------------------------------------------------------------------------
# Population group resolution
# ---------------------------------------------------------------------------

def _resolve_population(
    context: UserProfileContext,
) -> tuple[HbThresholdSet | None, str | None]:
    """
    Resolves the applicable WHO threshold set from user profile context.

    Returns:
        (HbThresholdSet, None) on success.
        (None, unclassifiable_reason: str) when profile is ambiguous or unsupported.
    """
    age = context.age
    gender = (context.gender or "").strip()
    pregnancy = (context.pregnancy_status or "").strip()

    # -----------------------------------------------------------------------
    # Guard: age is required for all WHO population groups
    # -----------------------------------------------------------------------
    if age is None:
        return None, (
            "Age is required for WHO haemoglobin classification but was not provided. "
            "Please complete your health profile."
        )

    # -----------------------------------------------------------------------
    # Children: classifications are age-based only (WHO does not split by sex
    # for children under 15 years in these threshold tables)
    # -----------------------------------------------------------------------
    if age < 1:
        return None, (
            f"Age {age} years is below the supported range (≥6 months). "
            "WHO thresholds for infants under 6 months are not implemented."
        )

    if age < 5:
        # 6 months to <5 years; map as 6–59 months group
        return WHO_CHILD_6_59M, None

    if age <= 11:
        return WHO_CHILD_5_11Y, None

    if age <= 14:
        return WHO_CHILD_12_14Y, None

    # -----------------------------------------------------------------------
    # Adults (≥15 years): require sex/gender and pregnancy status
    # -----------------------------------------------------------------------
    gender_lower = gender.lower()

    # Explicitly unsupported / undisclosed sex
    if gender_lower in ("other", "prefer not to say", ""):
        return None, (
            "Sex/gender is recorded as undisclosed or non-binary. "
            "WHO haemoglobin thresholds are defined for males and females only. "
            "Classification cannot be performed without a disclosed sex. "
            "Please consult a healthcare provider for a personalised assessment."
        )

    if gender_lower == "female":
        pregnancy_lower = pregnancy.lower()
        if pregnancy_lower == "pregnant":
            # Trimester not collected — single cutoff used, note appended
            return WHO_PREGNANT_WOMEN, None

        if pregnancy_lower in ("not pregnant", "not applicable", ""):
            # Treat missing/not-applicable as non-pregnant female
            return WHO_NON_PREGNANT_WOMEN, None

        # Unrecognised pregnancy value
        return None, (
            f"Pregnancy status '{pregnancy}' is not recognised. "
            "Expected: 'Pregnant', 'Not pregnant', or 'Not applicable'."
        )

    if gender_lower == "male":
        return WHO_MEN, None

    return None, (
        f"Gender value '{gender}' is not recognised for WHO classification. "
        "Accepted values: 'Female', 'Male', 'Other', 'Prefer not to say'."
    )


# ---------------------------------------------------------------------------
# Hb tier classification
# ---------------------------------------------------------------------------

def _classify_hb(hb: float, thresholds: HbThresholdSet) -> RiskCategory:
    """
    Classifies a single Hb value against a threshold set.
    Boundary rule: value exactly at a boundary → higher (less severe) tier.
    """
    if hb >= thresholds.normal_cutoff:
        return RiskCategory.NORMAL
    if hb >= thresholds.mild_floor:
        return RiskCategory.MILD
    if hb >= thresholds.moderate_floor:
        return RiskCategory.MODERATE
    return RiskCategory.SEVERE


# ---------------------------------------------------------------------------
# Public classification entry point
# ---------------------------------------------------------------------------

def classify_anaemia_risk(
    hb_estimate: float,
    hb_range: list[float],
    context: UserProfileContext,
) -> ClassificationResult:
    """
    Deterministic WHO-based anaemia risk classification.

    Args:
        hb_estimate: Hb value from ML model (g/dL).
        hb_range:    Calibrated uncertainty interval [lower, upper].
        context:     Demographic context from user profile.

    Returns:
        ClassificationResult — always succeeds; UNCLASSIFIABLE when profile
        is ambiguous, unsupported, or missing required fields.
    """
    threshold_set, reason = _resolve_population(context)

    if threshold_set is None:
        logger.info(
            "Anaemia classification is UNCLASSIFIABLE: %s (hb_estimate suppressed for privacy)",
            reason,
        )
        return ClassificationResult(
            risk_category=RiskCategory.UNCLASSIFIABLE,
            hb_estimate=hb_estimate,
            hb_range=hb_range,
            applicable_population="Unknown",
            threshold_version=THRESHOLD_SCHEMA_VERSION,
            reference_source=REFERENCE_SOURCE,
            thresholds_applied=None,
            unclassifiable_reason=reason,
        )

    risk = _classify_hb(hb_estimate, threshold_set)

    logger.info(
        "Anaemia classification: population=%s tier=%s threshold_version=%s",
        threshold_set.population_label,
        risk.value,
        THRESHOLD_SCHEMA_VERSION,
    )

    return ClassificationResult(
        risk_category=risk,
        hb_estimate=hb_estimate,
        hb_range=hb_range,
        applicable_population=threshold_set.population_label,
        threshold_version=THRESHOLD_SCHEMA_VERSION,
        reference_source=REFERENCE_SOURCE,
        thresholds_applied=ThresholdInfo(
            normal_cutoff=threshold_set.normal_cutoff,
            mild_floor=threshold_set.mild_floor,
            moderate_floor=threshold_set.moderate_floor,
        ),
    )
