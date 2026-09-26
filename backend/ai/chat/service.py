"""
HemoLens AI — Health Assistant Service
======================================
Single-turn orchestration for the conversational health assistant:

profile + last-6 reports (Supabase) → compact context → short history +
long-term facts → LangChain messages → LLM → fallback-safe response.

Never raises except ValueError on an invalid ``user_id`` UUID.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Optional

try:
    from backend.ai.chat.context import build_chat_context, format_context_for_prompt
    from backend.ai.chat.llm import get_chat_llm
    from backend.ai.chat.memory import append_turn, get_history, load_user_facts, merge_user_facts
    from backend.ai.chat.prompts import ASSISTANT_SYSTEM_PROMPT, DISCLAIMER_TEXT
    from backend.ai.gemini.client import get_gemini_model_name
    from backend.services.persistence import get_supabase_client
except ModuleNotFoundError:
    from ai.chat.context import build_chat_context, format_context_for_prompt
    from ai.chat.llm import get_chat_llm
    from ai.chat.memory import append_turn, get_history, load_user_facts, merge_user_facts
    from ai.chat.prompts import ASSISTANT_SYSTEM_PROMPT, DISCLAIMER_TEXT
    from ai.gemini.client import get_gemini_model_name
    from services.persistence import get_supabase_client

try:
    from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
except ImportError:
    AIMessage = None  # type: ignore
    HumanMessage = None  # type: ignore
    SystemMessage = None  # type: ignore

logger = logging.getLogger(__name__)


def _safe_model_name() -> str:
    try:
        return get_gemini_model_name()
    except Exception:
        return "gemini-2.5-flash"


def _fetch_profile_and_reports(user_id: str) -> tuple[Optional[dict], list[dict]]:
    """Fetch profile + newest-first report stubs; failures → (None, [])."""
    try:
        try:
            client = get_supabase_client()
        except Exception:
            return None, []
        if client is None:
            return None, []

        profile: Optional[dict] = None
        try:
            presp = client.from_("user_profiles").select("*").eq("id", user_id).execute()
            rows = getattr(presp, "data", None) or []
            if rows and isinstance(rows[0], dict):
                profile = rows[0]
        except Exception:
            profile = None

        ctx_reports: list[dict] = []
        try:
            rresp = (
                client.from_("reports")
                .select("screening_id,result,created_at")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(6)
                .execute()
            )
            rrows = getattr(rresp, "data", None) or []

            date_map: dict[str, Any] = {}
            try:
                sids = [
                    r.get("screening_id")
                    for r in rrows
                    if isinstance(r, dict) and r.get("screening_id")
                ]
                if sids:
                    sresp = client.from_("screenings").select("id,created_at").in_("id", sids).execute()
                    for s in getattr(sresp, "data", None) or []:
                        if isinstance(s, dict) and s.get("id"):
                            date_map[str(s["id"])] = s.get("created_at")
            except Exception:
                date_map = {}

            for r in rrows:
                if not isinstance(r, dict):
                    continue
                sid = r.get("screening_id")
                created = date_map.get(str(sid)) if sid else None
                created = created or r.get("created_at")
                ctx_reports.append({"created_at": created, "result": r.get("result")})
        except Exception:
            ctx_reports = []

        return profile, ctx_reports
    except Exception:
        return None, []


def _format_facts_block(facts: Any) -> str:
    try:
        if not isinstance(facts, dict) or not facts:
            return "Stored conversation notes: none."
        parts: list[str] = []
        topics = facts.get("recent_topics")
        if isinstance(topics, list) and topics:
            parts.append("recent topics: " + ", ".join(str(t) for t in topics[-10:]))
        notes = facts.get("user_notes")
        if isinstance(notes, str) and notes.strip():
            parts.append("user notes: " + notes.strip()[:500])
        if not parts:
            return "Stored conversation notes: none."
        return "Stored conversation notes: " + " | ".join(parts) + "."
    except Exception:
        return "Stored conversation notes: none."


def _fallback_message(ctx: Any) -> str:
    try:
        latest = ctx.get("latest") if isinstance(ctx, dict) else None
        if isinstance(latest, dict) and (latest.get("risk_category") or latest.get("hb_range")):
            risk = latest.get("risk_category") or "unknown"
            hb = latest.get("hb_range")
            if isinstance(hb, (list, tuple)) and len(hb) >= 2:
                return (
                    f"Based on your latest screening estimate (risk: {risk}, "
                    f"Hb range {hb[0]}-{hb[1]} g/dL — a screening estimate, not a lab measurement), "
                    "I can't provide a diagnosis here. Please discuss these results with a "
                    "qualified physician and confirm with a laboratory Complete Blood Count (CBC) test. "
                    "If you develop concerning symptoms, seek care promptly."
                )
            return (
                f"Based on your latest screening estimate (risk: {risk}), "
                "I can't provide a diagnosis here. Please discuss these results with a "
                "qualified physician and confirm with a laboratory Complete Blood Count (CBC) test. "
                "If you develop concerning symptoms, seek care promptly."
            )
    except Exception:
        pass
    return (
        "I'm having trouble reaching the AI service right now, so I can't give a personalized answer. "
        "Your screening result is only a preliminary estimate — please discuss it with a qualified "
        "physician and confirm with a laboratory Complete Blood Count (CBC) test. "
        "If you develop concerning symptoms, seek care promptly."
    )


async def run_assistant_turn(user_id: str, session_id: str, message: str) -> dict[str, Any]:
    """
    Run one assistant turn.

    Returns ``{"message", "tips", "disclaimer", "model", "context_used",
    "status"}``. Never raises except ValueError on an invalid ``user_id``.
    """
    try:
        uuid.UUID(str(user_id))
    except (ValueError, TypeError, AttributeError):
        raise ValueError(f"Invalid user_id UUID: {user_id}")

    text = message if isinstance(message, str) else str(message or "")
    text = text.strip()
    sid = session_id if isinstance(session_id, str) and session_id.strip() else "default"
    key = f"{user_id}:{sid}"
    model_name = _safe_model_name()

    profile, raw_reports = _fetch_profile_and_reports(str(user_id))

    try:
        ctx = build_chat_context(profile, raw_reports)
    except Exception:
        ctx = {"profile_compact": {}, "latest": None, "history": []}

    try:
        history = get_history(key, limit=8)
    except Exception:
        history = []

    try:
        facts = load_user_facts(str(user_id))
    except Exception:
        facts = {}
    if not isinstance(facts, dict):
        facts = {}

    try:
        context_used = bool(ctx.get("profile_compact") or ctx.get("latest") is not None)
    except Exception:
        context_used = False

    try:
        context_block = format_context_for_prompt(ctx)
    except Exception:
        context_block = "No prior screening context available."
    facts_block = _format_facts_block(facts)
    system_text = ASSISTANT_SYSTEM_PROMPT + "\n\n" + context_block + "\n\n" + facts_block

    reply: Optional[str] = None
    try:
        llm = get_chat_llm()
    except Exception:
        llm = None

    if llm is not None and SystemMessage is not None and HumanMessage is not None:
        try:
            messages: list[Any] = [SystemMessage(content=system_text)]
            for item in (history or [])[-8:]:
                if not isinstance(item, dict):
                    continue
                role = str(item.get("role", "")).lower()
                content = str(item.get("text", ""))
                if not content:
                    continue
                if role in ("human", "user"):
                    messages.append(HumanMessage(content=content))
                elif role in ("ai", "assistant", "model") and AIMessage is not None:
                    messages.append(AIMessage(content=content))
            messages.append(HumanMessage(content=text if text else "Hello"))
            resp = await llm.ainvoke(messages)
            content = getattr(resp, "content", None)
            if isinstance(content, str) and content.strip():
                reply = content.strip()
            elif isinstance(content, list):
                parts: list[str] = []
                for block in content:
                    if isinstance(block, str):
                        parts.append(block)
                    elif isinstance(block, dict) and isinstance(block.get("text"), str):
                        parts.append(block["text"])
                joined = "".join(parts).strip()
                reply = joined or None
            elif content:
                try:
                    reply = str(content).strip() or None
                except Exception:
                    reply = None
        except Exception as exc:
            logger.warning("Chat LLM invocation failed: %s", exc)
            reply = None

    if reply:
        status = "complete"
    else:
        status = "fallback"
        reply = _fallback_message(ctx)

    try:
        append_turn(key, "human", text if text else "Hello")
    except Exception:
        pass
    try:
        append_turn(key, "ai", reply)
    except Exception:
        pass

    try:
        topic = (text or "")[:60].strip()
        if topic:
            merge_user_facts(str(user_id), {"recent_topics": [topic]})
    except Exception:
        pass

    return {
        "message": reply,
        "tips": [],
        "disclaimer": DISCLAIMER_TEXT,
        "model": model_name,
        "context_used": context_used,
        "status": status,
    }
