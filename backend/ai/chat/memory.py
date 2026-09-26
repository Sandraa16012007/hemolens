"""
HemoLens AI — Chat Memory (Short-Term + Persistent)
===================================================
Short-term: in-memory per-session deque (max 10 turns), thread-safe.
Secondary only — used for within-request speed.

Persistent (Supabase ``chat_memory``, one row per user):
- ``profile_details``: compact allowlisted health context (synced from
  ``user_profiles``; never invented).
- ``reports``: compact screening summaries, newest-first, capped at 20.
- ``facts.conversations``: last 10 exchanges (20 messages) with UTC
  timestamps, each ``{"role": "user"|"assistant", "content": str,
  "timestamp": ISO}``.

All functions never raise; failures yield empty defaults / False.
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

MAX_EXCHANGES = 10
MAX_MESSAGES = MAX_EXCHANGES * 2
MAX_REPORTS = 20

_PROFILE_ALLOWLIST: tuple[str, ...] = (
    "name",
    "age",
    "gender",
    "height_cm",
    "weight_kg",
    "dietary_pattern",
    "previous_anemia_history",
    "chronic_conditions",
    "symptoms",
    "pregnancy_status",
    "location",
)

_REPORT_KEYS: tuple[str, ...] = (
    "screening_id",
    "date",
    "hb_range",
    "risk_category",
    "key_factors",
)


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


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_empty_value(val: Any) -> bool:
    if val is None:
        return True
    if isinstance(val, str) and not val.strip():
        return True
    if isinstance(val, (list, tuple)) and len(val) == 0:
        return True
    if isinstance(val, dict) and len(val) == 0:
        return True
    return False


def _compact_profile(profile: Any) -> dict[str, Any]:
    """Keep only allowlisted keys; drop null/empty; never invent values."""
    try:
        if not isinstance(profile, dict):
            return {}
        # Legacy alias: user_profiles rows carry ``anemia_history``.
        alias_history = profile.get("anemia_history")
        compact: dict[str, Any] = {}
        for key in _PROFILE_ALLOWLIST:
            if key == "previous_anemia_history" and "previous_anemia_history" not in profile:
                val = alias_history
            else:
                val = profile.get(key)
            if _is_empty_value(val):
                continue
            compact[key] = val
        return compact
    except Exception:
        return {}


def _sanitize_conversations(raw: Any) -> list[dict[str, Any]]:
    try:
        if not isinstance(raw, list):
            return []
        clean: list[dict[str, Any]] = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            role = str(item.get("role", "")).strip().lower()
            if role not in ("user", "assistant"):
                continue
            content = item.get("content")
            if not isinstance(content, str) or not content.strip():
                continue
            entry: dict[str, Any] = {"role": role, "content": content}
            ts = item.get("timestamp")
            if isinstance(ts, str) and ts.strip():
                entry["timestamp"] = ts
            clean.append(entry)
        return clean
    except Exception:
        return []


def _trim_conversations(conversations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Pure helper: keep only the last 20 messages (10 exchanges)."""
    try:
        if not isinstance(conversations, list):
            return []
        return list(conversations[-MAX_MESSAGES:])
    except Exception:
        return []


def _sanitize_report(raw: Any) -> dict[str, Any] | None:
    try:
        if not isinstance(raw, dict):
            return None
        sid = raw.get("screening_id")
        if sid is None or (isinstance(sid, str) and not sid.strip()):
            return None
        entry: dict[str, Any] = {"screening_id": str(sid)}
        date = raw.get("date")
        entry["date"] = str(date) if date is not None else None
        hb = raw.get("hb_range")
        if isinstance(hb, (list, tuple)) and len(hb) >= 2:
            try:
                entry["hb_range"] = [float(hb[0]), float(hb[1])]
            except (TypeError, ValueError):
                entry["hb_range"] = None
        else:
            entry["hb_range"] = None
        risk = raw.get("risk_category")
        entry["risk_category"] = str(risk) if risk is not None else None
        factors = raw.get("key_factors")
        if isinstance(factors, list):
            entry["key_factors"] = [str(f).strip() for f in factors if str(f).strip()][:5]
        else:
            entry["key_factors"] = []
        return entry
    except Exception:
        return None


def _sanitize_reports(raw: Any) -> list[dict[str, Any]]:
    try:
        if not isinstance(raw, list):
            return []
        clean: list[dict[str, Any]] = []
        for item in raw:
            entry = _sanitize_report(item)
            if entry is not None:
                clean.append(entry)
        return clean[:MAX_REPORTS]
    except Exception:
        return []


def _dedupe_reports(reports: list[dict[str, Any]], screening_id: str) -> bool:
    """Pure helper: True when ``screening_id`` already exists in ``reports``."""
    try:
        if not isinstance(reports, list) or screening_id is None:
            return False
        target = str(screening_id)
        for item in reports:
            if isinstance(item, dict) and str(item.get("screening_id")) == target:
                return True
        return False
    except Exception:
        return False


def get_user_memory(user_id: str) -> dict[str, Any]:
    """
    Load persistent memory: ``{"profile_details", "reports",
    "conversations"}``. Missing row/table → all empty defaults. Never raises.
    """
    empty = {"profile_details": {}, "reports": [], "conversations": []}
    try:
        if not user_id:
            return {"profile_details": {}, "reports": [], "conversations": []}
        client = get_supabase_client()
        if client is None:
            return {"profile_details": {}, "reports": [], "conversations": []}
        try:
            resp = (
                client.from_("chat_memory")
                .select("user_id,profile_details,reports,facts")
                .eq("user_id", str(user_id))
                .execute()
            )
        except Exception:
            # Pre-v2 table without the new columns: fall back to facts only.
            try:
                resp = (
                    client.from_("chat_memory")
                    .select("facts")
                    .eq("user_id", str(user_id))
                    .execute()
                )
            except Exception as exc:
                logger.debug("get_user_memory failed for %s: %s", user_id, exc)
                return {"profile_details": {}, "reports": [], "conversations": []}
        rows = getattr(resp, "data", None) or []
        if not rows or not isinstance(rows[0], dict):
            return {"profile_details": {}, "reports": [], "conversations": []}
        row = rows[0]
        profile = row.get("profile_details")
        profile_details = dict(profile) if isinstance(profile, dict) else {}
        reports = _sanitize_reports(row.get("reports"))
        facts = row.get("facts")
        conversations: list[dict[str, Any]] = []
        if isinstance(facts, dict):
            conversations = _sanitize_conversations(facts.get("conversations"))
        return {
            "profile_details": profile_details,
            "reports": reports,
            "conversations": _trim_conversations(conversations),
        }
    except Exception as exc:
        logger.debug("get_user_memory failed for %s: %s", user_id, exc)
        return {"profile_details": {}, "reports": [], "conversations": []}


def ensure_user_memory(user_id: str, profile: dict | None = None) -> dict[str, Any]:
    """
    Ensure a ``chat_memory`` row exists; sync ``profile_details`` when a
    profile is given (no duplicate rows). Returns :func:`get_user_memory`.
    Never raises.
    """
    try:
        if not user_id:
            return {"profile_details": {}, "reports": [], "conversations": []}
        uid = str(user_id)
        client = get_supabase_client()
        if client is None:
            return {"profile_details": {}, "reports": [], "conversations": []}
        try:
            payload = {
                "user_id": uid,
                "profile_details": _compact_profile(profile) if isinstance(profile, dict) else {},
                "reports": [],
                "facts": {"conversations": []},
                "updated_at": _utc_now_iso(),
            }
            try:
                client.from_("chat_memory").upsert(
                    payload, on_conflict="user_id", ignore_duplicates=True
                ).execute()
            except TypeError:
                # Older postgrest-py without ignore_duplicates: plain insert,
                # conflict (row exists) is fine and ignored.
                try:
                    client.from_("chat_memory").insert(payload).execute()
                except Exception:
                    pass
        except Exception as exc:
            logger.debug("ensure_user_memory insert failed for %s: %s", user_id, exc)
        if isinstance(profile, dict):
            try:
                client.from_("chat_memory").update(
                    {
                        "profile_details": _compact_profile(profile),
                        "updated_at": _utc_now_iso(),
                    }
                ).eq("user_id", uid).execute()
            except Exception as exc:
                logger.debug("ensure_user_memory profile sync failed for %s: %s", user_id, exc)
        return get_user_memory(uid)
    except Exception as exc:
        logger.debug("ensure_user_memory failed for %s: %s", user_id, exc)
        return {"profile_details": {}, "reports": [], "conversations": []}


def append_report(user_id: str, report: dict[str, Any]) -> bool:
    """
    Prepend a compact report (newest-first); skip when ``screening_id``
    already stored; cap at 20 entries. Never raises (False on failure).
    """
    try:
        if not user_id or not isinstance(report, dict):
            return False
        entry = _sanitize_report(report)
        if entry is None:
            return False
        client = get_supabase_client()
        if client is None:
            return False
        mem = get_user_memory(str(user_id))
        existing = mem.get("reports")
        if not isinstance(existing, list):
            existing = []
        if _dedupe_reports(existing, str(entry["screening_id"])):
            return True
        updated = [entry] + [r for r in existing if isinstance(r, dict)]
        updated = updated[:MAX_REPORTS]
        try:
            client.from_("chat_memory").update(
                {"reports": updated, "updated_at": _utc_now_iso()}
            ).eq("user_id", str(user_id)).execute()
            return True
        except Exception as exc:
            logger.debug("append_report update failed for %s: %s", user_id, exc)
            # Row may not exist yet — create it, then retry the update.
            try:
                ensure_user_memory(str(user_id))
                client.from_("chat_memory").update(
                    {"reports": updated, "updated_at": _utc_now_iso()}
                ).eq("user_id", str(user_id)).execute()
                return True
            except Exception as exc2:
                logger.debug("append_report retry failed for %s: %s", user_id, exc2)
                return False
    except Exception as exc:
        logger.debug("append_report failed for %s: %s", user_id, exc)
        return False


def save_exchange(user_id: str, user_text: str, assistant_text: str) -> bool:
    """
    Append one user+assistant pair (UTC timestamps) to
    ``facts.conversations``, trimmed to the last 20 messages. Creates the
    row when missing. Never raises (False on failure).
    """
    try:
        if not user_id:
            return False
        user_content = user_text if isinstance(user_text, str) else str(user_text or "")
        assistant_content = (
            assistant_text if isinstance(assistant_text, str) else str(assistant_text or "")
        )
        if not user_content.strip() or not assistant_content.strip():
            return False
        client = get_supabase_client()
        if client is None:
            return False
        now = _utc_now_iso()
        mem = get_user_memory(str(user_id))
        conversations = mem.get("conversations")
        if not isinstance(conversations, list):
            conversations = []
        conversations = list(conversations) + [
            {"role": "user", "content": user_content, "timestamp": now},
            {"role": "assistant", "content": assistant_content, "timestamp": now},
        ]
        conversations = _trim_conversations(_sanitize_conversations(conversations))
        try:
            facts_resp = (
                client.from_("chat_memory")
                .select("facts")
                .eq("user_id", str(user_id))
                .execute()
            )
            rows = getattr(facts_resp, "data", None) or []
            base_facts = rows[0].get("facts") if rows and isinstance(rows[0], dict) else {}
            if not isinstance(base_facts, dict):
                base_facts = {}
        except Exception:
            base_facts = {}
        new_facts = dict(base_facts)
        new_facts["conversations"] = conversations
        try:
            client.from_("chat_memory").update(
                {"facts": new_facts, "updated_at": now}
            ).eq("user_id", str(user_id)).execute()
            return True
        except Exception as exc:
            logger.debug("save_exchange update failed for %s: %s", user_id, exc)
            try:
                ensure_user_memory(str(user_id))
                client.from_("chat_memory").update(
                    {"facts": new_facts, "updated_at": now}
                ).eq("user_id", str(user_id)).execute()
                return True
            except Exception as exc2:
                logger.debug("save_exchange retry failed for %s: %s", user_id, exc2)
                return False
    except Exception as exc:
        logger.debug("save_exchange failed for %s: %s", user_id, exc)
        return False


def load_user_facts(user_id: str) -> dict[str, Any]:
    """Legacy alias: returns ``{"conversations": [...]}`` (never raises)."""
    try:
        mem = get_user_memory(str(user_id))
        conversations = mem.get("conversations")
        if not isinstance(conversations, list):
            conversations = []
        return {"conversations": conversations}
    except Exception:
        return {"conversations": []}


def merge_user_facts(user_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    """
    Legacy alias: appends ``patch["conversations"]`` entries (capped at 20)
    and returns the facts dict (never raises).
    """
    try:
        if not user_id or not isinstance(patch, dict):
            return {"conversations": []}
        additions = _sanitize_conversations(patch.get("conversations"))
        if not additions:
            return load_user_facts(str(user_id))
        client = get_supabase_client()
        if client is None:
            return load_user_facts(str(user_id))
        mem = get_user_memory(str(user_id))
        conversations = mem.get("conversations")
        if not isinstance(conversations, list):
            conversations = []
        merged = _trim_conversations(list(conversations) + additions)
        try:
            facts_resp = (
                client.from_("chat_memory")
                .select("facts")
                .eq("user_id", str(user_id))
                .execute()
            )
            rows = getattr(facts_resp, "data", None) or []
            base_facts = rows[0].get("facts") if rows and isinstance(rows[0], dict) else {}
            if not isinstance(base_facts, dict):
                base_facts = {}
        except Exception:
            base_facts = {}
        new_facts = dict(base_facts)
        new_facts["conversations"] = merged
        try:
            client.from_("chat_memory").update(
                {"facts": new_facts, "updated_at": _utc_now_iso()}
            ).eq("user_id", str(user_id)).execute()
        except Exception:
            try:
                ensure_user_memory(str(user_id))
                client.from_("chat_memory").update(
                    {"facts": new_facts, "updated_at": _utc_now_iso()}
                ).eq("user_id", str(user_id)).execute()
            except Exception as exc:
                logger.debug("merge_user_facts failed for %s: %s", user_id, exc)
                return load_user_facts(str(user_id))
        return {"conversations": merged}
    except Exception as exc:
        logger.debug("merge_user_facts failed for %s: %s", user_id, exc)
        return {"conversations": []}


def reset_short_term_memory() -> None:
    """Clear all in-memory session turns (primarily for testing)."""
    with _STORE_LOCK:
        _STORE.clear()
