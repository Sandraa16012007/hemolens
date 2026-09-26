"""
HemoLens Backend — Conversational Health Assistant Router
=========================================================
POST /api/chat
------------
Single-turn educational health assistant over screening history
and health context. Graceful fallback on LLM failures (never 500).

GET /api/chat/memory
--------------------
Returns persistent chat memory (profile_details + reports +
conversations) for the authenticated user. Never 500.

Auth
----
User identity is resolved ONLY from the ``Authorization: Bearer
<supabase access token>`` header via the service client
``auth.get_user(token)``. Any ``user_id`` in the request body is
ignored and never accepted.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field, field_validator

try:
    from backend.ai.chat import (
        ensure_user_memory,
        get_user_memory,
        run_assistant_turn,
        sync_reports_from_db,
    )
    from backend.services.persistence import get_supabase_client
except ModuleNotFoundError:
    from ai.chat import (
        ensure_user_memory,
        get_user_memory,
        run_assistant_turn,
        sync_reports_from_db,
    )
    from services.persistence import get_supabase_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])

_DEFAULT_DISCLAIMER = (
    "Educational information only — not a medical diagnosis. "
    "Please consult a qualified physician and confirm with a laboratory Complete Blood Count (CBC) test."
)

_FALLBACK_MESSAGE = (
    "I'm having trouble reaching the AI service right now, so I can't give a personalized answer. "
    "Your screening result is only a preliminary estimate — please discuss it with a qualified "
    "physician and confirm with a laboratory Complete Blood Count (CBC) test. "
    "If you develop concerning symptoms, seek care promptly."
)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    session_id: str = Field(default="default", max_length=64)
    message: str = Field(..., min_length=1, max_length=1000)

    @field_validator("session_id", mode="before")
    @classmethod
    def _strip_session_id(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("message", mode="after")
    @classmethod
    def _strip_non_empty_message(cls, v: str) -> str:
        stripped = v.strip() if isinstance(v, str) else v
        if not stripped:
            raise ValueError("message must be non-empty")
        return stripped


class ChatResponse(BaseModel):
    status: str
    message: str
    tips: list[str]
    disclaimer: str
    model: str
    context_used: bool
    session_id: str


def _extract_user_id(resp: Any) -> str | None:
    """Defensively extract ``.user.id`` from a Supabase get_user response."""
    try:
        user = getattr(resp, "user", None)
        if user is None and isinstance(resp, dict):
            # Dict shapes: {"user": {...}} or {"data": {"user": {...}}}
            inner = resp.get("user")
            if inner is None and isinstance(resp.get("data"), dict):
                inner = resp["data"].get("user")
            user = inner if inner is not None else resp
        if user is None:
            return None
        uid = getattr(user, "id", None)
        if uid is None and isinstance(user, dict):
            uid = user.get("id")
        if uid is None or (isinstance(uid, str) and not uid.strip()):
            return None
        return str(uid).strip() if isinstance(uid, str) else str(uid)
    except Exception:
        return None


def _authenticate(request: Request) -> str:
    """
    Resolve the user id ONLY from ``Authorization: Bearer <token>`` via the
    Supabase service client ``auth.get_user(token)``.

    Raises HTTPException 401 ``{code: AUTH_REQUIRED}`` on missing/invalid
    token. Never raises any other exception.
    """
    try:
        auth = request.headers.get("authorization") or request.headers.get("Authorization")
        if not auth or not isinstance(auth, str):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "AUTH_REQUIRED", "message": "Authentication required."},
            )
        parts = auth.strip().split(None, 1)
        if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "AUTH_REQUIRED", "message": "Authentication required."},
            )
        token = parts[1].strip()

        try:
            client = get_supabase_client()
        except Exception:
            client = None
        if client is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "AUTH_REQUIRED", "message": "Authentication required."},
            )

        try:
            auth_api = getattr(client, "auth", None)
            get_user = getattr(auth_api, "get_user", None) if auth_api is not None else None
            if get_user is None or not callable(get_user):
                raise ValueError("auth service unavailable")
            resp = get_user(token)
        except HTTPException:
            raise
        except Exception as exc:
            logger.debug("Supabase token verification failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "AUTH_REQUIRED", "message": "Invalid or expired token."},
            ) from exc

        user_id = _extract_user_id(resp)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "AUTH_REQUIRED", "message": "Invalid or expired token."},
            )
        return user_id
    except HTTPException:
        raise
    except Exception as exc:
        logger.debug("Authentication failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_REQUIRED", "message": "Authentication required."},
        ) from exc


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Chat with the HemoLens health assistant",
    description=(
        "Runs a single assistant turn over the user's screening history and health context. "
        "Requires Authorization: Bearer <supabase access token>. "
        "Returns a fallback response instead of an error if the AI service is unavailable."
    ),
)
async def chat(request: Request, payload: ChatRequest) -> ChatResponse:
    user_id = _authenticate(request)
    session_id = payload.session_id.strip() or "default"
    message = payload.message.strip()
    try:
        result = await run_assistant_turn(user_id, session_id, message)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": str(exc)},
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error in chat endpoint: %s", exc)
        return ChatResponse(
            status="fallback",
            message=_FALLBACK_MESSAGE,
            tips=[],
            disclaimer=_DEFAULT_DISCLAIMER,
            model="gemini-2.5-flash",
            context_used=False,
            session_id=session_id,
        )
    return ChatResponse(
        status=str(result.get("status", "complete")),
        message=str(result.get("message", _FALLBACK_MESSAGE)),
        tips=list(result.get("tips", []) or []),
        disclaimer=str(result.get("disclaimer", _DEFAULT_DISCLAIMER)),
        model=str(result.get("model", "gemini-2.5-flash")),
        context_used=bool(result.get("context_used", False)),
        session_id=session_id,
    )


@router.get(
    "/chat/memory",
    summary="Get persistent chat memory for the authenticated user",
    description=(
        "Returns profile_details, reports, conversations and reports_count "
        "from persistent memory. Initializes the row on first load. "
        "Requires Authorization: Bearer <supabase access token>. Never 500."
    ),
)
async def get_chat_memory(request: Request) -> dict[str, Any]:
    user_id = _authenticate(request)
    try:
        # Fetch authoritative profile row (best-effort; never raises).
        profile: Any = None
        try:
            client = get_supabase_client()
            if client is not None:
                presp = client.from_("user_profiles").select("*").eq("id", user_id).execute()
                rows = getattr(presp, "data", None) or []
                if rows and isinstance(rows[0], dict):
                    profile = rows[0]
        except Exception as exc:
            logger.debug("Memory profile fetch failed for %s: %s", user_id, exc)
            profile = None

        # Ensure row exists (first-load init) then backfill reports.
        try:
            ensure_user_memory(user_id, profile if isinstance(profile, dict) else None)
        except Exception as exc:
            logger.debug("ensure_user_memory failed for %s: %s", user_id, exc)
        try:
            sync_reports_from_db(user_id)
        except Exception as exc:
            logger.debug("sync_reports_from_db failed for %s: %s", user_id, exc)

        try:
            mem = get_user_memory(user_id)
        except Exception as exc:
            logger.debug("get_user_memory failed for %s: %s", user_id, exc)
            mem = None
        if not isinstance(mem, dict):
            mem = {"profile_details": {}, "reports": [], "conversations": []}
        profile_details = mem.get("profile_details")
        if not isinstance(profile_details, dict):
            profile_details = {}
        reports = mem.get("reports")
        if not isinstance(reports, list):
            reports = []
        conversations = mem.get("conversations")
        if not isinstance(conversations, list):
            conversations = []
        return {
            "status": "complete",
            "profile_details": profile_details,
            "reports": reports,
            "conversations": conversations,
            "reports_count": len(reports),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unexpected error in chat memory endpoint: %s", exc)
        return {
            "status": "complete",
            "profile_details": {},
            "reports": [],
            "conversations": [],
            "reports_count": 0,
        }
