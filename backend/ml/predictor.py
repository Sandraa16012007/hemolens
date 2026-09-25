"""
HemoLens ML — Canonical Hemoglobin Regression Inference Service
================================================================
Production inference service for continuous hemoglobin prediction from
handcrafted palpebral conjunctiva color features.

Design Principles:
1. Thread-safe singleton model bundle caching — loaded once, reused for all requests.
2. Strict schema and feature order validation via Pydantic (eyelid_49_v1).
3. Explicit rejection of missing, unexpected, or non-finite feature values.
4. Pure and deterministic inference — no external side-effects or network calls.
5. Structured logging for observability without exposing patient identifiers.
"""

from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Any, Sequence, Union

import joblib
import numpy as np
from pydantic import ValidationError
from sklearn.pipeline import Pipeline

try:
    from backend.ml.schemas import (
        EYELID_49_FEATURE_NAMES,
        EyelidFeatureVectorInput,
        HbPredictionOutput,
        ModelMetadata,
    )
except ModuleNotFoundError:
    from ml.schemas import (
        EYELID_49_FEATURE_NAMES,
        EyelidFeatureVectorInput,
        HbPredictionOutput,
        ModelMetadata,
    )

logger = logging.getLogger(__name__)

# Model bundle path resolution
_MODULE_DIR = Path(__file__).parent.resolve()
_PRIMARY_MODEL_PATH = _MODULE_DIR / "eyelid_hb_model_v1.joblib"
_ALT_MODEL_PATH = _MODULE_DIR.parent / "models" / "eyelid_hb_model_v1.joblib"

# Thread-safe bundle singleton storage
_BUNDLE_LOCK = threading.Lock()
_CACHED_BUNDLE: dict[str, Any] | None = None
_CACHED_BUNDLE_PATH: Path | None = None
_LOAD_COUNT: int = 0


def load_model_bundle(model_path: str | Path | None = None) -> dict[str, Any]:
    """
    Loads and caches the serialized ML model bundle into memory as a singleton.
    Thread-safe; guaranteed to load only once per process lifecycle unless
    an explicit new path is provided.
    """
    global _CACHED_BUNDLE, _CACHED_BUNDLE_PATH, _LOAD_COUNT

    target_path = Path(model_path).resolve() if model_path else _PRIMARY_MODEL_PATH

    with _BUNDLE_LOCK:
        if _CACHED_BUNDLE is not None and _CACHED_BUNDLE_PATH == target_path:
            return _CACHED_BUNDLE

        if not target_path.exists():
            if _ALT_MODEL_PATH.exists():
                target_path = _ALT_MODEL_PATH
            else:
                err_msg = f"ML model bundle not found at {target_path} or {_ALT_MODEL_PATH}."
                logger.error(err_msg)
                raise FileNotFoundError(err_msg)

        logger.info("Initializing HemoLens ML model bundle from: %s", target_path)
        try:
            bundle = joblib.load(target_path)
        except Exception as exc:
            logger.exception("Failed to deserialize model bundle at %s: %s", target_path, exc)
            raise RuntimeError(f"Could not load ML model bundle: {exc}") from exc

        # Validate bundle integrity
        required_keys = {"model", "feature_names", "calibration_margin", "error_ceiling"}
        missing_keys = required_keys - set(bundle.keys())
        if missing_keys:
            err_msg = f"Corrupted model bundle at {target_path}: missing required keys {missing_keys}"
            logger.error(err_msg)
            raise ValueError(err_msg)

        _CACHED_BUNDLE = bundle
        _CACHED_BUNDLE_PATH = target_path
        _LOAD_COUNT += 1
        logger.info(
            "ML model bundle loaded successfully (version=%s, model=%s, features=%d, load_count=%d)",
            bundle.get("model_version", "v1"),
            bundle.get("model_name", "Unknown"),
            len(bundle.get("feature_names", [])),
            _LOAD_COUNT,
        )
        return _CACHED_BUNDLE


def get_bundle_load_count() -> int:
    """Returns the number of times a bundle file was read from disk."""
    return _LOAD_COUNT


def get_model_metadata(bundle: dict[str, Any] | None = None) -> ModelMetadata:
    """
    Extracts standardized metadata from the model bundle.
    """
    active_bundle = bundle or load_model_bundle()
    feature_names = list(active_bundle["feature_names"])
    return ModelMetadata(
        model_name=str(active_bundle.get("model_name", "Extra Trees")),
        model_version=str(active_bundle.get("model_version", "eyelid_hb_model_v1")),
        feature_schema_version=str(active_bundle.get("feature_schema_version", "eyelid_49_v1")),
        feature_count=len(feature_names),
        feature_names=feature_names,
        calibration_margin=float(active_bundle.get("calibration_margin", 2.86)),
        error_ceiling=float(active_bundle.get("error_ceiling", 5.34)),
        trained_at=active_bundle.get("trained_at"),
        test_metrics=active_bundle.get("test_metrics"),
    )


def validate_and_order_features(
    feature_input: Union[EyelidFeatureVectorInput, dict[str, float], Sequence[float], np.ndarray],
    expected_feature_names: Sequence[str] = EYELID_49_FEATURE_NAMES,
) -> tuple[np.ndarray, EyelidFeatureVectorInput]:
    """
    Validates feature input against the strict schema and returns an ordered NumPy vector
    along with the validated Pydantic model.

    Raises:
        ValueError: If features are missing, unexpected, of wrong length, or contain NaN/Inf.
    """
    if isinstance(feature_input, EyelidFeatureVectorInput):
        validated_schema = feature_input
    elif isinstance(feature_input, dict):
        try:
            validated_schema = EyelidFeatureVectorInput(**feature_input)
        except ValidationError as exc:
            logger.warning("Feature dictionary failed schema validation: %s", exc)
            raise ValueError(f"Invalid feature input dictionary: {exc}") from exc
    elif isinstance(feature_input, (list, tuple, np.ndarray)):
        arr = np.asarray(feature_input, dtype=np.float64)
        if arr.ndim > 1:
            arr = arr.squeeze()
        if arr.shape != (len(expected_feature_names),):
            raise ValueError(
                f"Feature sequence length mismatch: expected {len(expected_feature_names)}, received {arr.shape[0]}."
            )
        try:
            validated_schema = EyelidFeatureVectorInput.from_sequence(arr.tolist(), expected_feature_names)
        except (ValidationError, ValueError) as exc:
            logger.warning("Feature sequence failed schema validation: %s", exc)
            raise ValueError(f"Invalid feature sequence values: {exc}") from exc
    else:
        raise TypeError(
            f"Unsupported feature input type: {type(feature_input).__name__}. "
            f"Expected EyelidFeatureVectorInput, dict, or numeric sequence."
        )

    ordered_vector = validated_schema.to_ordered_array(expected_feature_names)
    return ordered_vector, validated_schema


def vector_from_input(
    feature_input: Union[EyelidFeatureVectorInput, dict[str, float], Sequence[float], np.ndarray],
    expected_feature_names: Sequence[str] = EYELID_49_FEATURE_NAMES,
) -> np.ndarray:
    """Convenience helper returning just the ordered NumPy vector."""
    vec, _ = validate_and_order_features(feature_input, expected_feature_names)
    return vec


def get_tree_std(model: Any, X_rows: np.ndarray) -> np.ndarray | None:
    """
    Calculates tree-to-tree standard deviation across ensemble estimators.
    """
    inner = model.named_steps["model"] if isinstance(model, Pipeline) else model
    estimators = getattr(inner, "estimators_", None)
    if estimators is None:
        return None

    scaler = model.named_steps.get("scaler") if isinstance(model, Pipeline) else None
    X_use = scaler.transform(X_rows) if scaler is not None else X_rows

    per_tree = np.array([t.predict(X_use) for t in estimators])
    return per_tree.std(axis=0)


def predict_hb(
    feature_input: Union[EyelidFeatureVectorInput, dict[str, float], Sequence[float], np.ndarray],
    bundle: dict[str, Any] | None = None,
) -> HbPredictionOutput:
    """
    Canonical ML inference function for HemoLens Hemoglobin estimation.

    Args:
        feature_input: 49-feature dictionary, sequence, or validated Pydantic model.
        bundle: Optional model bundle. When None, uses the cached singleton.

    Returns:
        Canonical HbPredictionOutput object containing hb_estimate, hb_range, and confidence.

    Raises:
        ValueError: On schema violation, missing/extra features, or non-finite values.
        RuntimeError: If model inference fails.
    """
    active_bundle = bundle or load_model_bundle()
    expected_names = active_bundle.get("feature_names", EYELID_49_FEATURE_NAMES)

    ordered_vec, _ = validate_and_order_features(feature_input, expected_names)

    model = active_bundle["model"]
    X_sample = ordered_vec.reshape(1, -1)

    try:
        raw_hb = float(model.predict(X_sample)[0])
    except Exception as exc:
        logger.exception("Model prediction execution error: %s", exc)
        raise RuntimeError(f"Model prediction failed: {exc}") from exc

    # Uncertainty and confidence calculation
    calibration_margin = float(active_bundle.get("calibration_margin", 2.86))
    expected_error = calibration_margin

    if active_bundle.get("uses_tree_ensemble_confidence") and active_bundle.get("error_calibrator") is not None:
        tree_std = get_tree_std(model, X_sample)
        if tree_std is not None:
            calibrator = active_bundle["error_calibrator"]
            expected_error = float(calibrator.predict(tree_std)[0])

    expected_error = max(expected_error, 0.0)
    error_ceiling = float(active_bundle.get("error_ceiling", 5.34))

    confidence = 1.0 - (expected_error / error_ceiling) if error_ceiling > 0 else 1.0
    confidence = float(np.clip(confidence, 0.0, 1.0))

    hb_estimate = round(raw_hb, 2)
    hb_lower = round(hb_estimate - calibration_margin, 2)
    hb_upper = round(hb_estimate + calibration_margin, 2)

    return HbPredictionOutput(
        hb_estimate=hb_estimate,
        hb_range=[hb_lower, hb_upper],
        confidence=round(confidence, 2),
        model_version=str(active_bundle.get("model_version", "eyelid_hb_model_v1")),
        model_name=str(active_bundle.get("model_name", "Extra Trees")),
        feature_schema_version=str(active_bundle.get("feature_schema_version", "eyelid_49_v1")),
    )
