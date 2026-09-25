"""
HemoLens ML Package
===================
Canonical interface for Hemoglobin ML model inference.
"""

from .predictor import (
    load_model_bundle,
    predict_hb,
    get_model_metadata,
    validate_and_order_features,
    get_bundle_load_count,
)
from .schemas import (
    EYELID_49_FEATURE_NAMES,
    EyelidFeatureVectorInput,
    HbPredictionOutput,
    ModelMetadata,
)

__all__ = [
    "load_model_bundle",
    "predict_hb",
    "get_model_metadata",
    "validate_and_order_features",
    "get_bundle_load_count",
    "EYELID_49_FEATURE_NAMES",
    "EyelidFeatureVectorInput",
    "HbPredictionOutput",
    "ModelMetadata",
]
