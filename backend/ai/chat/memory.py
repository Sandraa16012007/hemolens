"""
HemoLens AI — Chat Memory (Short-Term + Long-Term)
==================================================
Short-term: in-memory per-session deque (max 10 turns), thread-safe.
Long-term: Supabase ``chat_memory`` table holding ONLY conversational
facts (``recent_topics``, ``user_notes``) — never Hb/clinical numbers.

All functions never raise; failures yield empty defaults.
"""

from __future__ import annotations

import logging
import threading
from collections import deque
from datetime import datetime, timezone
from typing import Any

try:
    from backend.services.persistence import get_supabase_client
except ModuleNotFoundError:
    try:
        from services.persistence import get_supabase_client
    except (ModuleNotFoundError, ImportError):

        def get_supabase_client() -> Any:  # type: ignore
            return None

logger = logging.getLogger(__name__)

_STORE_LOCK = threading.Lock()
_STORE: dict[str, deque] = {}

_ALLOWED_FACT_KEYS: tuple[str, ...] = ("recent_topics", "user_notes")
_MAX_TOPICS = 10
_MAX_NOTES_CHARS = 500


def get_history(key: str, limit: int = 8) -> list[dict[str, str]]:
    """Return the last ``limit`` turns for a session key (never raises)."""
    try:
        if not isinstance(key, str) or not key:
            return []
        try:
            lim = int(limit)
        except (TypeError, ValueError):
            lim = 8
        lim = max(0, min(lim, 10))
        with _STORE_LOCK:
            turns = _STORE.get(key)
            items = list(turns) if turns is not None else []
        if lim == 0:
            return []
        return [dict(t) for t in items[-lim:]]
    except Exception:
        return []


def append_turn(key: str, role: str, text: str) -> None:
    """Append one ``{"role": ..., "text": ...}`` turn (never raises)."""
    try:
        if not isinstance(key, str) or not key:
            return
        entry = {"role": str(role), "text": str(text)}
        with _STORE_LOCK:
            turns = _STORE.get(key)
            if turns is None:
                turns = deque(maxlen=10)
                _STORE[key] = turns
            turns.append(entry)
    except Exception:
        return


def _sanitize_facts(raw: Any) -> dict[str, Any]:
    try:
        if not isinstance(raw, dict):
            return {}
        clean: dict[str, Any] = {}
        topics = raw.get("recent_topics")
        if isinstance(topics, list):
            strs = [str(t).strip() for t in topics if str(t).strip()]
            if strs:
                clean["recent_topics"] = strs[-_MAX_TOPICS:]
        notes = raw.get("user_notes")
        if isinstance(notes, str) and notes.strip():
            clean["user_notes"] = notes.strip()[:_MAX_NOTES_CHARS]
        return clean
    except Exception:
        return {}


def load_user_facts(user_id: str) -> dict[str, Any]:
    """Load long-term conversational facts (``{}`` on any failure)."""
    try:
        if not user_id:
            return {}
        client = get_supabase_client()
        if client is None:
            return {}
        resp = client.from_("chat_memory").select("facts").eq("user_id", str(user_id)).execute()
        rows = getattr(resp, "data", None) or []
        if not rows or not isinstance(rows[0], dict):
            return {}
        return _sanitize_facts(rows[0].get("facts"))
    except Exception as exc:
        logger.debug("load_user_facts failed for %s: %s", user_id, exc)
        return {}


def merge_user_facts(user_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    """
    Merge conversational facts and upsert them (``{}`` on any failure).

    Only ``recent_topics`` (appended, capped at 10) and ``user_notes``
    (overwritten, capped at 500 chars) are stored.
    """
    try:
        if not user_id or not isinstance(patch, dict):
            return {}
        existing = load_user_facts(str(user_id))
        merged: dict[str, Any] = dict(existing)

        new_topics = patch.get("recent_topics")
        if isinstance(new_topics, list):
            current = merged.get("recent_topics")
            base = list(current) if isinstance(current, list) else []
            additions = [str(t).strip() for t in new_topics if str(t).strip()]
            merged["recent_topics"] = (base + additions)[-_MAX_TOPICS:]
            if not merged["recent_topics"]:
                merged.pop("recent_topics", None)

        new_notes = patch.get("user_notes")
        if isinstance(new_notes, str) and new_notes.strip():
            merged["user_notes"] = new_notes.strip()[:_MAX_NOTES_CHARS]

        merged = _sanitize_facts(merged)

        client = get_supabase_client()
        if client is None:
            return {}
        payload = {
            "user_id": str(user_id),
            "facts": merged,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        client.from_("chat_memory").upsert(payload, on_conflict="user_id").execute()
        return merged
    except Exception as exc:
        logger.debug("merge_user_facts failed for %s: %s", user_id, exc)
        return {}


def reset_short_term_memory() -> None:
    """Clear all in-memory session turns (primarily for testing)."""
    with _STORE_LOCK:
        _STORE.clear()
