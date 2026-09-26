"""
HemoLens AI — Health Assistant Service
======================================
Single-turn orchestration for the conversational health assistant:

persistent memory (profile_details + reports + conversations) →
compact context → persisted history → LangChain messages → LLM →
fallback-safe response.

Persistent memory is the source of truth and is read through from the DB
on every call (correctness over speed); the in-memory session store is
secondary. Successful turns persist exactly one exchange; fallbacks write
nothing (no memory corruption).

Never raises except ValueError on an invalid ``user_id`` UUID.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Optional

try:
    from backend.ai.chat.context import (
        _parse_report_entry,
        build_chat_context,
        format_context_for_prompt,
        format_stored_reports,
    )
    from backend.ai.chat.llm import get_chat_llm
    from backend.ai.chat.memory import (
        append_report,
        append_turn,
        ensure_user_memory,
        get_history,
        get_user_memory,
        save_exchange,
    )
    from backend.ai.chat.prompts import ASSISTANT_SYSTEM_PROMPT, DISCLAIMER_TEXT
    from backend.ai.gemini.client import get_gemini_model_name
    from backend.services.persistence import get_supabase_client
except ModuleNotFoundError:
    from ai.chat.context import (
        _parse_report_entry,
        build_chat_context,
        format_context_for_prompt,
        format_stored_reports,
    )
    from ai.chat.llm import get_chat_llm
    from ai.chat.memory import (
        append_report,
        append_turn,
        ensure_user_memory,
        get_history,
        get_user_memory,
        save_exchange,
    )
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


def _fetch_profile_row(user_id: str) -> Optional[dict]:
    """Fetch the ``user_profiles`` row; None on any failure."""
    try:
        client = get_supabase_client()
        if client is None:
            return None
        presp = client.from_("user_profiles").select("*").eq("id", user_id).execute()
        rows = getattr(presp, "data", None) or []
        if rows and isinstance(rows[0], dict):
            return rows[0]
        return None
    except Exception:
        return None


def _fetch_display_name(user_id: str) -> Optional[str]:
    """Best-effort auth display name (service client); None on any failure."""
    try:
        client = get_supabase_client()
        if client is None:
            return None
        admin = getattr(getattr(client, "auth", None), "admin", None)
        if admin is None:
            return None
        get_fn = getattr(admin, "get_user_by_id", None) or getattr(admin, "get_user", None)
        if get_fn is None or not callable(get_fn):
            return None
        res = get_fn(str(user_id))
        user = getattr(res, "user", None) or res
        meta = getattr(user, "user_metadata", None)
        if meta is None and isinstance(user, dict):
            inner = user.get("user") if isinstance(user.get("user"), dict) else user
            meta = inner.get("user_metadata") if isinstance(inner, dict) else None
        if isinstance(meta, dict):
            for key in ("display_name", "full_name", "name"):
                val = meta.get(key)
                if isinstance(val, str) and val.strip():
                    return val.strip()
        return None
    except Exception:
        return None


def sync_reports_from_db(user_id: str) -> int:
    """
    Backfill compact reports from the ``reports``/``screenings`` tables into
    persistent memory (idempotent via ``screening_id`` dedupe).

    Returns the number of reports ensured stored; 0 on any failure.
    """
    try:
        if not user_id:
            return 0
        try:
            client = get_supabase_client()
        except Exception:
            return 0
        if client is None:
            return 0

        try:
            rresp = (
                client.from_("reports")
                .select("screening_id,result,created_at")
                .eq("user_id", str(user_id))
                .order("created_at", desc=True)
                .limit(6)
                .execute()
            )
            rrows = getattr(rresp, "data", None) or []
        except Exception:
            return 0

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

        ensured = 0
        # DB rows arrive newest-first; append_report prepends, so process
        # oldest-first to keep the stored list newest-first.
        for r in reversed(rrows):
            try:
                if not isinstance(r, dict):
                    continue
                sid = r.get("screening_id")
                if not sid:
                    continue
                created = date_map.get(str(sid)) or r.get("created_at")
                parsed = _parse_report_entry({"created_at": created, "result": r.get("result")})
                if not isinstance(parsed, dict):
                    continue
                ok = append_report(
                    str(user_id),
                    {
                        "screening_id": str(sid),
                        "date": parsed.get("date"),
                        "hb_range": parsed.get("hb_range"),
                        "risk_category": parsed.get("risk_category"),
                        "key_factors": parsed.get("key_factors") or [],
                    },
                )
                if ok:
                    ensured += 1
            except Exception:
                continue
        return ensured
    except Exception:
        return 0


def _compact_to_entry(report: dict[str, Any]) -> dict[str, Any]:
    """Convert a stored compact report to a _parse_report_entry-compatible entry."""
    try:
        hb = report.get("hb_range")
        lo = hi = None
        if isinstance(hb, (list, tuple)) and len(hb) >= 2:
            try:
                lo, hi = float(hb[0]), float(hb[1])
            except (TypeError, ValueError):
                lo = hi = None
        result: dict[str, Any] = {}
        risk = report.get("risk_category")
        if risk is not None:
            result["clinical_classification"] = {"risk_category": str(risk)}
        if lo is not None and hi is not None:
            result["ml_prediction"] = {"hb_lower_bound": lo, "hb_upper_bound": hi}
        factors = report.get("key_factors")
        if isinstance(factors, list) and factors:
            result["narrative_report"] = {
                "factors_considered": [str(f) for f in factors if str(f).strip()][:5]
            }
        return {"created_at": report.get("date"), "result": result}
    except Exception:
        return {"created_at": None, "result": {}}


def _format_conversation_recap(conversations: Any) -> str:
    """Render older turns (beyond the last 8) as a short transcript block."""
    try:
        if not isinstance(conversations, list) or len(conversations) <= 8:
            return "Earlier conversation: none beyond recent turns."
        older = conversations[:-8]
        lines: list[str] = []
        for item in older[-12:]:
            if not isinstance(item, dict):
                continue
            role = str(item.get("role", "")).strip().lower()
            content = str(item.get("content", "") or "")
            if role not in ("user", "assistant") or not content.strip():
                continue
            lines.append(f"{role}: {content.strip()[:300]}")
        if not lines:
            return "Earlier conversation: none beyond recent turns."
        return "Earlier conversation:\n" + "\n".join(lines)
    except Exception:
        return "Earlier conversation: none beyond recent turns."


def _merge_history(
    persisted: Any, session_key: str
) -> list[tuple[str, str]]:
    """
    Persisted conversations (last 8) as primary plus in-memory session turns,
    deduped by exact (role, text), capped at the last 8. Never raises.
    """
    try:
        combined: list[tuple[str, str]] = []
        if isinstance(persisted, list):
            for item in persisted[-8:]:
                if not isinstance(item, dict):
                    continue
                role = str(item.get("role", "")).strip().lower()
                content = item.get("content", item.get("text", ""))
                content = str(content or "")
                if role in ("user", "human"):
                    combined.append(("user", content))
                elif role in ("assistant", "ai", "model"):
                    combined.append(("assistant", content))
        try:
            mem_turns = get_history(session_key, limit=8)
        except Exception:
            mem_turns = []
        for item in mem_turns or []:
            if not isinstance(item, dict):
                continue
            role = str(item.get("role", "")).strip().lower()
            content = str(item.get("text", item.get("content", "")) or "")
            if not content:
                continue
            if role in ("user", "human"):
                combined.append(("user", content))
            elif role in ("assistant", "ai", "model"):
                combined.append(("assistant", content))
        seen: set[tuple[str, str]] = set()
        deduped: list[tuple[str, str]] = []
        for pair in combined:
            if pair in seen:
                continue
            seen.add(pair)
            deduped.append(pair)
        return deduped[-8:]
    except Exception:
        return []


def _fallback_message(reports: Any) -> str:
    try:
        latest = reports[0] if isinstance(reports, list) and reports else None
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
    Fallbacks write nothing to memory; successes persist exactly one exchange.
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
    uid = str(user_id)

    # 1. Sync authoritative profile into persistent memory.
    try:
        profile_row = _fetch_profile_row(uid)
        profile_arg: dict[str, Any] = dict(profile_row) if isinstance(profile_row, dict) else {}
        try:
            display_name = _fetch_display_name(uid)
        except Exception:
            display_name = None
        if display_name and not str(profile_arg.get("name", "")).strip():
            profile_arg["name"] = display_name
        ensure_user_memory(uid, profile_arg or None)
    except Exception as exc:
        logger.debug("Profile sync failed for %s: %s", uid, exc)

    # 2. Backfill compact reports (idempotent), then read memory through.
    try:
        sync_reports_from_db(uid)
    except Exception as exc:
        logger.debug("Report sync failed for %s: %s", uid, exc)

    try:
        mem = get_user_memory(uid)
    except Exception:
        mem = {"profile_details": {}, "reports": [], "conversations": []}
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

    try:
        context_used = bool(profile_details or reports)
    except Exception:
        context_used = False

    # 3. Prompt context: structured ctx (reused builders over compact data)
    # plus exact per-report blocks plus older-turn recap.
    try:
        ctx_profile = dict(profile_details)
        if "previous_anemia_history" in ctx_profile and "anemia_history" not in ctx_profile:
            ctx_profile["anemia_history"] = ctx_profile["previous_anemia_history"]
        entries = [
            _compact_to_entry(r) for r in reports if isinstance(r, dict)
        ]
        ctx = build_chat_context(ctx_profile, entries)
    except Exception:
        ctx = {"profile_compact": {}, "latest": None, "history": []}
    try:
        context_block = format_context_for_prompt(ctx)
    except Exception:
        context_block = "No prior screening context available."
    try:
        reports_block = format_stored_reports(reports)
    except Exception:
        reports_block = "Stored screening reports: none available."
    recap_block = _format_conversation_recap(conversations)
    system_text = (
        ASSISTANT_SYSTEM_PROMPT + "\n\n" + context_block + "\n\n" + reports_block + "\n\n" + recap_block
    )

    # 4. LangChain history: persisted (primary) + in-memory, read fresh.
    history = _merge_history(conversations, key)

    reply: Optional[str] = None
    try:
        llm = get_chat_llm()
    except Exception:
        llm = None

    if llm is not None and SystemMessage is not None and HumanMessage is not None:
        try:
            messages: list[Any] = [SystemMessage(content=system_text)]
            for role, content in history:
                if not content:
                    continue
                if role == "user":
                    messages.append(HumanMessage(content=content))
                elif AIMessage is not None:
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
        # 5. Persist exactly one exchange + in-memory turns for speed.
        try:
            save_exchange(uid, text if text else "Hello", reply)
        except Exception:
            pass
        try:
            append_turn(key, "human", text if text else "Hello")
        except Exception:
            pass
        try:
            append_turn(key, "ai", reply)
        except Exception:
            pass
    else:
        # Fallback: write nothing to memory (no corruption from unpaired turns).
        status = "fallback"
        reply = _fallback_message(reports)

    return {
        "message": reply,
        "tips": [],
        "disclaimer": DISCLAIMER_TEXT,
        "model": model_name,
        "context_used": context_used,
        "status": status,
    }
