"""
HemoLens ML — Pydantic Schemas for Nail-Bed RGB Feature Vectors
================================================================
Dedicated nail schema (version `nail_rgb_v1`). Kept modular and fully
separate from the eyelid schema (`eyelid_49_v1` in `schemas.py`); the
existing eyelid schema and predictor are untouched.

Schema: 21 descriptors = 7 percentiles (p05/p15/p25/p50/p75/p85/p95)
x 3 channels (R, G, B), fixed order r_* -> g_* -> b_*.
"""

from __future__ import annotations

import math
from typing import Sequence

import numpy as np
from pydantic import BaseModel, ConfigDict, Field, field_validator


#: Schema version identifier for nail RGB percentile descriptors.
NAIL_SCHEMA_VERSION: str = "nail_rgb_v1"

_PCT_SUFFIX: tuple[str, ...] = ("p05", "p15", "p25", "p50", "p75", "p85", "p95")

#: Canonical ordered 21 nail feature names (r -> g -> b, ascending percentile).
NAIL_RGB_FEATURE_NAMES: tuple[str, ...] = tuple(
    [f"r_{s}" for s in _PCT_SUFFIX]
    + [f"g_{s}" for s in _PCT_SUFFIX]
    + [f"b_{s}" for s in _PCT_SUFFIX]
)

#: Percentile levels backing each *_pXX descriptor.
NAIL_RGB_PERCENTILES: tuple[int, ...] = (5, 15, 25, 50, 75, 85, 95)


class NailFeatureVectorInput(BaseModel):
    """
    Validated 21-feature input schema for future nail-bed Hb models.
    Rejects unexpected keys, missing keys, and non-finite numbers.
    NOT wired to any predictor yet (extraction layer only).
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    # R 7
    r_p05: float
    r_p15: float
    r_p25: float
    r_p50: float
    r_p75: float
    r_p85: float
    r_p95: float
    # G 7
    g_p05: float
    g_p15: float
    g_p25: float
    g_p50: float
    g_p75: float
    g_p85: float
    g_p95: float
    # B 7
    b_p05: float
    b_p15: float
    b_p25: float
    b_p50: float
    b_p75: float
    b_p85: float
    b_p95: float

    @field_validator("*")
    @classmethod
    def validate_finite_number(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("Feature values must be finite numbers (NaN and Inf are forbidden).")
        return float(v)

    def to_ordered_array(
        self, expected_order: Sequence[str] = NAIL_RGB_FEATURE_NAMES
    ) -> np.ndarray:
        """Attributes -> 1D float64 array in exact expected order."""
        data = self.model_dump()
        return np.array([data[k] for k in expected_order], dtype=np.float64)

    @classmethod
    def from_sequence(
        cls,
        values: Sequence[float],
        feature_names: Sequence[str] = NAIL_RGB_FEATURE_NAMES,
    ) -> NailFeatureVectorInput:
        """Construct from a sequential list of numbers (length must be 21)."""
        if len(values) != len(feature_names):
            raise ValueError(
                f"Feature vector has incorrect count: expected {len(feature_names)}, "
                f"received {len(values)}."
            )
        data = {name: float(val) for name, val in zip(feature_names, values)}
        return cls(**data)


class NailModelMetadata(BaseModel):
    """Lightweight metadata carrier for the nail feature schema version."""

    model_config = ConfigDict(frozen=True)

    feature_schema_version: str = Field(default=NAIL_SCHEMA_VERSION)
    feature_count: int = Field(default=21)
    feature_names: list[str] = Field(default_factory=lambda: list(NAIL_RGB_FEATURE_NAMES))
    aggregation: str = Field(default="median_across_valid_nails")
