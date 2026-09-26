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
    from backend.ai.chat.context import build_chat_context, format_context_for_prompt
    from backend.ai.chat.memory import append_turn, get_history, load_user_facts, merge_user_facts
    from backend.ai.chat.service import run_assistant_turn
except ModuleNotFoundError:
    from ai.chat.llm import get_chat_llm, is_chat_configured
    from ai.chat.prompts import ASSISTANT_SYSTEM_PROMPT, DISCLAIMER_TEXT
    from ai.chat.context import build_chat_context, format_context_for_prompt
    from ai.chat.memory import append_turn, get_history, load_user_facts, merge_user_facts
    from ai.chat.service import run_assistant_turn

__all__ = [
    "get_chat_llm",
    "is_chat_configured",
    "build_chat_context",
    "format_context_for_prompt",
    "get_history",
    "append_turn",
    "load_user_facts",
    "merge_user_facts",
    "run_assistant_turn",
    "ASSISTANT_SYSTEM_PROMPT",
    "DISCLAIMER_TEXT",
]
