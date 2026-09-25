"""
HemoLens Clinical Package
=========================
Deterministic WHO-based anaemia risk classification layer.
Sits between ML inference and Gemini report generation.
"""

from .risk_classifier import (
    classify_anaemia_risk,
    ClassificationResult,
    UserProfileContext,
    RiskCategory,
    ThresholdInfo,
)
from .anemia_thresholds import (
    THRESHOLD_SCHEMA_VERSION,
    REFERENCE_SOURCE,
    HbThresholdSet,
)

__all__ = [
    "classify_anaemia_risk",
    "ClassificationResult",
    "UserProfileContext",
    "RiskCategory",
    "ThresholdInfo",
    "THRESHOLD_SCHEMA_VERSION",
    "REFERENCE_SOURCE",
    "HbThresholdSet",
]
