"""
HemoLens AI — Gemini Client Initializer
========================================
Thread-safe client management for Google GenAI SDK.
Follows project environment configuration conventions without hardcoding secrets.
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Any, Optional

try:
    from backend import config
except ModuleNotFoundError:
    try:
        import config
    except ImportError:
        config = None  # type: ignore

try:
    from google import genai
    _GENAI_AVAILABLE = True
except ImportError:
    genai = None  # type: ignore
    _GENAI_AVAILABLE = False

logger = logging.getLogger(__name__)

_CLIENT_LOCK = threading.Lock()
_CACHED_CLIENT: Optional[Any] = None  # genai.Client
_CLIENT_INITIALIZED: bool = False

# Default model
DEFAULT_GEMINI_MODEL: str = "gemini-3.8-flash"


def get_gemini_api_key() -> str | None:
    """
    Retrieve Gemini API key from environment variables or backend config.
    Checks GEMINI_API_KEY first, followed by GOOGLE_API_KEY.
    """
    if config and hasattr(config, "GEMINI_API_KEY") and config.GEMINI_API_KEY:
        return config.GEMINI_API_KEY.strip()
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if key and key.strip():
        return key.strip()
    return None


def get_gemini_model_name() -> str:
    """Retrieve configured Gemini model name or fallback to default."""
    if config and hasattr(config, "GEMINI_MODEL") and config.GEMINI_MODEL:
        return config.GEMINI_MODEL.strip()
    return os.getenv("GEMINI_MODEL", DEFAULT_GEMINI_MODEL).strip() or DEFAULT_GEMINI_MODEL


def is_gemini_configured() -> bool:
    """Return True if google-genai package is installed and an API key is present."""
    if not _GENAI_AVAILABLE:
        return False
    return get_gemini_api_key() is not None


def get_gemini_client() -> Optional[genai.Client]:
    """
    Thread-safe getter returning the cached genai.Client singleton.
    Returns None if GenAI is unavailable or GEMINI_API_KEY is not configured.
    """
    global _CACHED_CLIENT, _CLIENT_INITIALIZED

    if _CLIENT_INITIALIZED:
        return _CACHED_CLIENT

    with _CLIENT_LOCK:
        if _CLIENT_INITIALIZED:
            return _CACHED_CLIENT

        if not _GENAI_AVAILABLE:
            logger.warning("google-genai package is not installed; AI report generation will use fallback.")
            _CLIENT_INITIALIZED = True
            _CACHED_CLIENT = None
            return None

        api_key = get_gemini_api_key()
        if not api_key:
            logger.info("GEMINI_API_KEY is not configured; AI report generation will use controlled fallback.")
            _CLIENT_INITIALIZED = True
            _CACHED_CLIENT = None
            return None

        try:
            client = genai.Client(api_key=api_key)
            _CACHED_CLIENT = client
            _CLIENT_INITIALIZED = True
            logger.info("Google GenAI client initialized successfully (model: %s).", get_gemini_model_name())
            return _CACHED_CLIENT
        except Exception as exc:
            logger.error("Failed to initialize Google GenAI client: %s", exc)
            _CLIENT_INITIALIZED = True
            _CACHED_CLIENT = None
            return None


def reset_gemini_client() -> None:
    """Reset cached client singleton (primarily for testing and reconfiguration)."""
    global _CACHED_CLIENT, _CLIENT_INITIALIZED
    with _CLIENT_LOCK:
        _CACHED_CLIENT = None
        _CLIENT_INITIALIZED = False
