"""
HemoLens ML — Pydantic Schemas for Model Input, Output, and Metadata
=====================================================================
Strictly typed contracts for Hb regression model inference.
"""

from __future__ import annotations

import math
from typing import Any, Optional, Sequence
import numpy as np
from pydantic import BaseModel, ConfigDict, Field, field_validator


# Canonical list of 49 handcrafted conjunctival feature names (schema: eyelid_49_v1)
EYELID_49_FEATURE_NAMES: tuple[str, ...] = (
    # RGB 15
    "r_mean", "r_std", "r_p25", "r_median", "r_p75",
    "g_mean", "g_std", "g_p25", "g_median", "g_p75",
    "b_mean", "b_std", "b_p25", "b_median", "b_p75",
    # HSV 15
    "h_mean", "h_std", "h_p25", "h_median", "h_p75",
    "s_mean", "s_std", "s_p25", "s_median", "s_p75",
    "v_mean", "v_std", "v_p25", "v_median", "v_p75",
    # CIELAB (OpenCV 0-255) 15
    "lab_l_mean", "lab_l_std", "lab_l_p25", "lab_l_median", "lab_l_p75",
    "lab_a_mean", "lab_a_std", "lab_a_p25", "lab_a_median", "lab_a_p75",
    "lab_b_mean", "lab_b_std", "lab_b_p25", "lab_b_median", "lab_b_p75",
    # Redness / erythema proxies 4
    "red_chromaticity_mean",
    "r_minus_g_mean",
    "r_minus_b_mean",
    "excess_red_mean",
)


class EyelidFeatureVectorInput(BaseModel):
    """
    Validated 49-feature input schema for eyelid Hb regression.
    Rejects unexpected keys, missing keys, and non-finite numbers (NaN, Inf).
    """
    model_config = ConfigDict(extra="forbid", frozen=True)

    # RGB 15
    r_mean: float
    r_std: float
    r_p25: float
    r_median: float
    r_p75: float
    g_mean: float
    g_std: float
    g_p25: float
    g_median: float
    g_p75: float
    b_mean: float
    b_std: float
    b_p25: float
    b_median: float
    b_p75: float

    # HSV 15
    h_mean: float
    h_std: float
    h_p25: float
    h_median: float
    h_p75: float
    s_mean: float
    s_std: float
    s_p25: float
    s_median: float
    s_p75: float
    v_mean: float
    v_std: float
    v_p25: float
    v_median: float
    v_p75: float

    # CIELAB 15
    lab_l_mean: float
    lab_l_std: float
    lab_l_p25: float
    lab_l_median: float
    lab_l_p75: float
    lab_a_mean: float
    lab_a_std: float
    lab_a_p25: float
    lab_a_median: float
    lab_a_p75: float
    lab_b_mean: float
    lab_b_std: float
    lab_b_p25: float
    lab_b_median: float
    lab_b_p75: float

    # Erythema proxies 4
    red_chromaticity_mean: float
    r_minus_g_mean: float
    r_minus_b_mean: float
    excess_red_mean: float

    @field_validator("*")
    @classmethod
    def validate_finite_number(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("Feature values must be finite numbers (NaN and Inf are forbidden).")
        return float(v)

    def to_ordered_array(self, expected_order: Sequence[str] = EYELID_49_FEATURE_NAMES) -> np.ndarray:
        """
        Converts schema attributes to a 1D float64 NumPy array in exact expected order.
        """
        data = self.model_dump()
        return np.array([data[k] for k in expected_order], dtype=np.float64)

    @classmethod
    def from_sequence(cls, values: Sequence[float], feature_names: Sequence[str] = EYELID_49_FEATURE_NAMES) -> EyelidFeatureVectorInput:
        """
        Constructs an input instance from a sequential list of numbers.
        """
        if len(values) != len(feature_names):
            raise ValueError(
                f"Feature vector has incorrect count: expected {len(feature_names)}, received {len(values)}."
            )
        data = {name: float(val) for name, val in zip(feature_names, values)}
        return cls(**data)


class HbPredictionOutput(BaseModel):
    """
    Canonical prediction output returned by the HemoLens ML inference service.
    """
    model_config = ConfigDict(frozen=True)

    hb_estimate: float = Field(
        ...,
        description="Continuous hemoglobin prediction in g/dL (e.g., 12.35).",
    )
    hb_range: list[float] = Field(
        ...,
        min_length=2,
        max_length=2,
        description="Calibrated uncertainty interval [lower_bound, upper_bound] in g/dL.",
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Empirical model confidence score between 0.0 and 1.0 (calibrated dispersion/residual based).",
    )
    model_version: str = Field(
        default="eyelid_hb_model_v1",
        description="Model version identifier.",
    )
    model_name: str = Field(
        default="Extra Trees",
        description="Underlying model family name.",
    )
    feature_schema_version: str = Field(
        default="eyelid_49_v1",
        description="Feature schema version used during model training.",
    )


class ModelMetadata(BaseModel):
    """
    Metadata carried inside the serialized model bundle.
    """
    model_config = ConfigDict(frozen=True)

    model_name: str
    model_version: str
    feature_schema_version: str
    feature_count: int
    feature_names: list[str]
    calibration_margin: float
    error_ceiling: float
    trained_at: Optional[str] = None
    test_metrics: Optional[dict[str, Any]] = None
