"""
hemolens_predict.py — Backward-compatible wrapper for HemoLens ML inference.
Delegates to backend.ml.predictor for unified lifecycle management.
"""

from __future__ import annotations

from typing import Any, Sequence, Union
import numpy as np

try:
    from backend.ml.predictor import (
        load_model_bundle as load_bundle,
        predict_hb,
        get_tree_std,
        vector_from_input as _vector_from_input,
    )
except ModuleNotFoundError:
    from ml.predictor import (
        load_model_bundle as load_bundle,
        predict_hb,
        get_tree_std,
        vector_from_input as _vector_from_input,
    )


def predict_hb_from_bundle(
    feature_input: Union[dict[str, float], Sequence[float], np.ndarray],
    bundle: dict[str, Any],
) -> dict[str, Any]:
    """
    Returns exactly {"hb_estimate", "hb_range", "confidence"}.
    """
    res = predict_hb(feature_input, bundle=bundle)
    return {
        "hb_estimate": res.hb_estimate,
        "hb_range": res.hb_range,
        "confidence": res.confidence,
    }


__all__ = ["load_bundle", "predict_hb_from_bundle", "get_tree_std", "_vector_from_input"]
