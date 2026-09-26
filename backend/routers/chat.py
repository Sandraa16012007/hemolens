"""
HemoLens Backend — Conversational Health Assistant Router
=========================================================
POST /api/chat
------------
Single-turn educational health assistant over screening history
and health context. Graceful fallback on LLM failures (never 500).
"""

from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, field_validator

try:
    from backend.ai.chat import run_assistant_turn
except ModuleNotFoundError:
    from ai.chat import run_assistant_turn

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
    user_id: str
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


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Chat with the HemoLens health assistant",
    description=(
        "Runs a single assistant turn over the user's screening history and health context. "
        "Returns a fallback response instead of an error if the AI service is unavailable."
    ),
)
async def chat(payload: ChatRequest) -> ChatResponse:
    session_id = payload.session_id.strip() or "default"
    message = payload.message.strip()
    try:
        result = await run_assistant_turn(payload.user_id, session_id, message)
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
