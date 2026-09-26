"""
HemoLens AI — Conversational Health Assistant Package
=====================================================
Educational wellness assistant over screening history and health context.
Provider access is isolated in :mod:`llm`; all consumers use the
re-exports below.
"""

from __future__ import annotations

try:
    from backend.ai.chat.llm import get_chat_llm, is_chat_configured
    from backend.ai.chat.prompts import ASSISTANT_SYSTEM_PROMPT, DISCLAIMER_TEXT
    from backend.ai.chat.context import build_chat_context, format_context_for_prompt, format_stored_reports
    from backend.ai.chat.memory import (
        append_turn,
        append_report,
        ensure_user_memory,
        get_history,
        get_user_memory,
        load_user_facts,
        merge_user_facts,
        save_exchange,
    )
    from backend.ai.chat.service import run_assistant_turn, sync_reports_from_db
except ModuleNotFoundError:
    from ai.chat.llm import get_chat_llm, is_chat_configured
    from ai.chat.prompts import ASSISTANT_SYSTEM_PROMPT, DISCLAIMER_TEXT
    from ai.chat.context import build_chat_context, format_context_for_prompt, format_stored_reports
    from ai.chat.memory import (
        append_turn,
        append_report,
        ensure_user_memory,
        get_history,
        get_user_memory,
        load_user_facts,
        merge_user_facts,
        save_exchange,
    )
    from ai.chat.service import run_assistant_turn, sync_reports_from_db

__all__ = [
    "get_chat_llm",
    "is_chat_configured",
    "build_chat_context",
    "format_context_for_prompt",
    "format_stored_reports",
    "get_history",
    "append_turn",
    "get_user_memory",
    "ensure_user_memory",
    "append_report",
    "save_exchange",
    "load_user_facts",
    "merge_user_facts",
    "run_assistant_turn",
    "sync_reports_from_db",
    "ASSISTANT_SYSTEM_PROMPT",
    "DISCLAIMER_TEXT",
]
