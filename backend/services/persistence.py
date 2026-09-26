"""
HemoLens Backend — Supabase Persistence Service
================================================
Idempotent persistence layer for screening sessions and structured reports.

Guarantees:
1. Strict separation of machine-generated numeric ML predictions from LLM narrative fields.
2. Idempotent upsert operations (retrying/refreshing requests with the same screening ID does not duplicate records).
3. Non-blocking error containment: Supabase connection failures or missing credentials
   never crash the screening response.
4. Privacy compliance: zero raw prompts, tokens, or unnecessary PII persisted.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Optional

try:
    from supabase import Client, create_client
    _SUPABASE_SDK_AVAILABLE = True
except ImportError:
    Client = Any  # type: ignore
    create_client = None  # type: ignore
    _SUPABASE_SDK_AVAILABLE = False

try:
    from backend import config
    from backend.ai.gemini.schemas import (
        MLScreeningContext,
        ScreeningReportData,
        SymptomsContext,
        UserHealthProfileContext,
    )
except ModuleNotFoundError:
    import config
    from ai.gemini.schemas import (
        MLScreeningContext,
        ScreeningReportData,
        SymptomsContext,
        UserHealthProfileContext,
    )

logger = logging.getLogger(__name__)

_CLIENT_INSTANCE: Optional[Client] = None
_CLIENT_INITIALIZED: bool = False


def is_valid_uuid(val: str | None) -> bool:
    """Validate if string is a valid UUID."""
    if not val:
        return False
    try:
        uuid.UUID(str(val))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


def get_supabase_client() -> Optional[Client]:
    """
    Returns a cached Supabase client singleton using service role key or anon key.
    Returns None if SDK is missing or SUPABASE_URL is not configured.
    """
    global _CLIENT_INSTANCE, _CLIENT_INITIALIZED

    if _CLIENT_INITIALIZED:
        return _CLIENT_INSTANCE

    if not _SUPABASE_SDK_AVAILABLE:
        logger.warning("supabase-py SDK is not available; persistence operations will be skipped.")
        _CLIENT_INITIALIZED = True
        _CLIENT_INSTANCE = None
        return None

    url = config.SUPABASE_URL.strip()
    key = (config.SUPABASE_SERVICE_ROLE_KEY or config.SUPABASE_ANON_KEY).strip()

    if not url or not key:
        logger.info("Supabase URL or Key not configured; persistence operations will be skipped.")
        _CLIENT_INITIALIZED = True
        _CLIENT_INSTANCE = None
        return None

    try:
        _CLIENT_INSTANCE = create_client(url, key)
        _CLIENT_INITIALIZED = True
        logger.info("Supabase persistence client initialized successfully.")
        return _CLIENT_INSTANCE
    except Exception as exc:
        logger.error("Failed to initialize Supabase client: %s", exc)
        _CLIENT_INITIALIZED = True
        _CLIENT_INSTANCE = None
        return None


def reset_supabase_client() -> None:
    """Reset cached client singleton for testing."""
    global _CLIENT_INSTANCE, _CLIENT_INITIALIZED
    _CLIENT_INSTANCE = None
    _CLIENT_INITIALIZED = False


def persist_screening_and_report(
    screening_id: str,
    user_id: Optional[str],
    created_at: str,
    ml_result: MLScreeningContext,
    report_data: ScreeningReportData,
    report_status: str,  # "complete" | "failed" | "fallback" | "generating" | "pending"
    user_profile: Optional[UserHealthProfileContext] = None,
    symptoms: Optional[SymptomsContext] = None,
    roi_info: Optional[dict[str, Any]] = None,
    eyelid_image_url: Optional[str] = None,
    eyelid_image_path: Optional[str] = None,
) -> tuple[bool, Optional[str]]:
    """
    Idempotently persists the screening session and structured report to Supabase.
    Separates numerical ML predictions from narrative AI content in the reports.result JSONB.

    Args:
        screening_id: Unique screening UUID.
        user_id: User UUID if authenticated.
        created_at: ISO timestamp.
        ml_result: Immutable numerical ML prediction and clinical classification.
        report_data: Structured clinical educational report.
        report_status: Status string (complete, failed, fallback).
        user_profile: Optional demographic profile.
        symptoms: Optional symptoms reported.
        roi_info: Optional bounding box and pixel count.
        eyelid_image_url: Optional image storage URL.
        eyelid_image_path: Optional storage path.

    Returns:
        tuple[bool, Optional[str]]: (success, error_message_if_any)
    """
    client = get_supabase_client()
    if client is None:
        return False, "Supabase is not configured or offline."

    # Validate UUIDs
    safe_screening_id = str(screening_id)
    if not is_valid_uuid(safe_screening_id):
        return False, f"Invalid screening_id UUID: {screening_id}"

    # Build separated structured result JSON
    structured_result: dict[str, Any] = {
        "screening_id": safe_screening_id,
        "user_id": user_id,
        "created_at": created_at,
        "report_generation_status": report_status,
        
        # 1. Machine-generated numerical predictions (Immutable source of truth)
        "ml_prediction": {
            "hb_estimate": ml_result.hb_estimate,
            "hb_lower_bound": ml_result.hb_range[0],
            "hb_upper_bound": ml_result.hb_range[1],
            "model_confidence": ml_result.confidence,
            "model_version": ml_result.model_version,
        },
        
        # 2. Deterministic WHO clinical classification
        "clinical_classification": {
            "risk_category": ml_result.risk_category,
            "reference_population": ml_result.applicable_reference_population,
            "threshold_version": ml_result.threshold_version,
            "reference_source": ml_result.reference_source,
            "thresholds_applied": ml_result.thresholds_applied,
            "unclassifiable_reason": ml_result.unclassifiable_reason,
        },
        
        # 3. LLM-generated narrative fields
        "narrative_report": {
            "summary": report_data.summary,
            "explanation": report_data.result_explanation,
            "factors_considered": report_data.factors_considered,
            "symptoms_considered": report_data.symptoms_considered,
            "health_profile_summary": report_data.health_profile_summary,
            "recommended_next_steps": report_data.recommended_next_steps,
            "confirmatory_testing_recommendation": report_data.confirmatory_testing_recommendation,
            "disclaimer": report_data.disclaimer,
        },
        
        # 4. Context & image metadata
        "roi_info": roi_info,
        "user_profile": user_profile.model_dump() if user_profile else {},
        "symptoms": symptoms.model_dump() if symptoms else {},
    }

    try:
        # Step 1: Idempotent screening record status update (user-owned rows only).
        # Image URL/path columns are OWNED by the frontend upload flow
        # (createScreeningWithImages + ROI storage uploads) and MUST NOT be
        # written here: this service never sees the real storage URLs, so
        # including those keys would overwrite good values with ""/guesses.
        if user_id and is_valid_uuid(user_id):
            screening_payload = {
                "id": safe_screening_id,
                "user_id": user_id,
                "status": "completed" if report_status in ("complete", "fallback") else "failed",
                "symptoms": symptoms.model_dump() if symptoms else {},
            }
            # Upsert into screenings (status/symptoms only; image columns untouched)
            client.from_("screenings").upsert(screening_payload, on_conflict="id").execute()

        # Step 2: Idempotent report record upsert (keyed on unique screening_id)
        report_payload = {
            "screening_id": safe_screening_id,
            "user_id": user_id if (user_id and is_valid_uuid(user_id)) else None,
            "status": "complete" if report_status in ("complete", "fallback") else "failed",
            "result": structured_result,
        }

        # If user_id is None, omit it so foreign key won't fail if schema permits or client handles
        if not report_payload["user_id"]:
            # Check if screening already has a user_id
            existing = client.from_("screenings").select("user_id").eq("id", safe_screening_id).execute()
            if existing.data and len(existing.data) > 0 and existing.data[0].get("user_id"):
                report_payload["user_id"] = existing.data[0]["user_id"]

        if report_payload.get("user_id"):
            client.from_("reports").upsert(report_payload, on_conflict="screening_id").execute()
            logger.info("Persisted screening and report for %s to Supabase.", safe_screening_id)
            return True, None
        else:
            logger.info("Skipped Supabase reports insert for %s: unauthenticated / missing user_id.", safe_screening_id)
            return True, "Unauthenticated session; screening not linked to a user profile in DB."

    except Exception as exc:
        logger.warning("Supabase persistence failed for screening %s: %s", safe_screening_id, exc)
        return False, f"Database persistence error: {exc}"
