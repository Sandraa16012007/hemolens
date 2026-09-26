"""
HemoLens AI — Chat LLM Provider (LangChain Gemini)
==================================================
Provider-isolated LangChain chat model singleton for the AI Health Assistant.

Only this module imports ``langchain_google_genai``. All chat features
consume :func:`get_chat_llm` / :func:`is_chat_configured` and never touch
the provider directly.
"""

from __future__ import annotations

import logging
import threading
from typing import Any, Optional

try:
    from backend.ai.gemini.client import get_gemini_api_key, get_gemini_model_name
except ModuleNotFoundError:
    try:
        from ai.gemini.client import get_gemini_api_key, get_gemini_model_name
    except (ModuleNotFoundError, ImportError):

        def get_gemini_api_key() -> Optional[str]:  # type: ignore
            return None

        def get_gemini_model_name() -> str:  # type: ignore
            return "gemini-2.5-flash"

try:
    from langchain_google_genai import ChatGoogleGenerativeAI

    _LC_GENAI_AVAILABLE = True
except ImportError:
    ChatGoogleGenerativeAI = None  # type: ignore
    _LC_GENAI_AVAILABLE = False

try:
    from langchain_core.language_models.chat_models import BaseChatModel
except ImportError:
    try:
        from langchain.schema import BaseChatModel  # type: ignore
    except ImportError:
        BaseChatModel = Any  # type: ignore

logger = logging.getLogger(__name__)

_LLM_LOCK = threading.Lock()
_CACHED_LLM: Optional[BaseChatModel] = None
_LLM_INITIALIZED: bool = False


def is_chat_configured() -> bool:
    """Return True when the LangChain Gemini provider is installed and keyed."""
    try:
        if not _LC_GENAI_AVAILABLE:
            return False
        return get_gemini_api_key() is not None
    except Exception:
        return False


def get_chat_llm() -> Optional[BaseChatModel]:
    """
    Thread-safe getter returning the cached chat model singleton.

    Returns None (never raises) when the provider is unavailable or the
    Gemini API key is not configured.
    """
    global _CACHED_LLM, _LLM_INITIALIZED

    if _LLM_INITIALIZED:
        return _CACHED_LLM

    with _LLM_LOCK:
        if _LLM_INITIALIZED:
            return _CACHED_LLM

        try:
            if not _LC_GENAI_AVAILABLE:
                logger.info("langchain-google-genai is not installed; chat assistant will use fallback.")
                _LLM_INITIALIZED = True
                _CACHED_LLM = None
                return None

            api_key = get_gemini_api_key()
            if not api_key:
                logger.info("GEMINI_API_KEY is not configured; chat assistant will use fallback.")
                _LLM_INITIALIZED = True
                _CACHED_LLM = None
                return None

            model_name = get_gemini_model_name()
            llm = ChatGoogleGenerativeAI(
                model=model_name,
                google_api_key=api_key,
                temperature=0.3,
                max_output_tokens=1024,
            )
            _CACHED_LLM = llm
            _LLM_INITIALIZED = True
            return _CACHED_LLM
        except Exception as exc:
            logger.warning("Failed to initialize chat LLM: %s", exc)
            _LLM_INITIALIZED = True
            _CACHED_LLM = None
            return None


def reset_chat_llm() -> None:
    """Reset the cached chat model singleton (primarily for testing)."""
    global _CACHED_LLM, _LLM_INITIALIZED
    with _LLM_LOCK:
        _CACHED_LLM = None
        _LLM_INITIALIZED = False
