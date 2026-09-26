"""
HemoLens AI — Chat Context Builder
==================================
Pure functions that compact user profile and screening history into a
minimal, privacy-safe context for the health assistant prompt.

Only whitelisted fields are extracted. Images, confidence scores,
thresholds, and model versions are never included.
"""

from __future__ import annotations

from typing import Any, Optional

_ALLOWED_PROFILE_KEYS: tuple[str, ...] = (
    "age",
    "gender",
    "height_cm",
    "weight_kg",
    "dietary_pattern",
    "anemia_history",
    "chronic_conditions",
    "symptoms",
    "pregnancy_status",
    "location",
)


def _extract_risk_category(result: Any) -> Optional[str]:
    try:
        if not isinstance(result, dict):
            return None
        cc = result.get("clinical_classification")
        if isinstance(cc, dict) and cc.get("risk_category"):
            return str(cc["risk_category"])
        if isinstance(result.get("risk_category"), str):
            return str(result["risk_category"])
        return None
    except Exception:
        return None


def _extract_hb_range(result: Any) -> Optional[list[float]]:
    try:
        if not isinstance(result, dict):
            return None
        candidates: list[Any] = []
        ml = result.get("ml_prediction")
        if isinstance(ml, dict):
            candidates.append(ml)
        candidates.append(result)
        for src in candidates:
            if not isinstance(src, dict):
                continue
            lo = src.get("hb_lower_bound")
            hi = src.get("hb_upper_bound")
            try:
                if lo is not None and hi is not None:
                    return [float(lo), float(hi)]
            except (TypeError, ValueError):
                pass
            hr = src.get("hb_range")
            try:
                if isinstance(hr, (list, tuple)) and len(hr) >= 2:
                    return [float(hr[0]), float(hr[1])]
            except (TypeError, ValueError):
                pass
        return None
    except Exception:
        return None


def _extract_key_factors(result: Any) -> list[str]:
    try:
        if not isinstance(result, dict):
            return []
        nr = result.get("narrative_report")
        if not isinstance(nr, dict):
            return []
        for key in ("factors_considered", "risk_factors"):
            val = nr.get(key)
            if isinstance(val, list) and val:
                out = [str(x).strip() for x in val if str(x).strip()]
                return out[:5]
        return []
    except Exception:
        return []


def _parse_report_entry(entry: Any) -> Optional[dict[str, Any]]:
    try:
        if not isinstance(entry, dict):
            return None
        date = entry.get("created_at")
        result = entry.get("result")
        parsed: dict[str, Any] = {
            "date": str(date) if date is not None else None,
            "risk_category": _extract_risk_category(result),
            "hb_range": _extract_hb_range(result),
            "key_factors": _extract_key_factors(result),
        }
        return parsed
    except Exception:
        return None


def build_chat_context(
    profile: dict | None,
    reports: list[dict],
) -> dict[str, Any]:
    """
    Build a compact chat context from a user profile and report rows.

    Args:
        profile: user_profiles row (or None).
        reports: newest-first list of ``{"created_at": ..., "result": ...}``
            dicts where ``result`` is the reports.result JSONB payload.

    Returns:
        ``{"profile_compact": {...}, "latest": {...} | None,
        "history": [...]}``. Never raises — returns empty defaults on bad input.
    """
    try:
        compact: dict[str, Any] = {}
        try:
            if isinstance(profile, dict):
                for key in _ALLOWED_PROFILE_KEYS:
                    val = profile.get(key)
                    if val is None:
                        continue
                    if isinstance(val, str) and not val.strip():
                        continue
                    if isinstance(val, (list, tuple)) and len(val) == 0:
                        continue
                    if isinstance(val, dict) and len(val) == 0:
                        continue
                    compact[key] = val
        except Exception:
            compact = {}

        parsed: list[dict[str, Any]] = []
        try:
            if isinstance(reports, list):
                for entry in reports:
                    item = _parse_report_entry(entry)
                    if item is not None:
                        parsed.append(item)
        except Exception:
            parsed = []

        latest = parsed[0] if parsed else None
        history = parsed[1:6] if len(parsed) > 1 else []
        return {"profile_compact": compact, "latest": latest, "history": history}
    except Exception:
        return {"profile_compact": {}, "latest": None, "history": []}


def format_context_for_prompt(ctx: dict) -> str:
    """Render a compact plain-text context block for the assistant prompt."""
    try:
        if not isinstance(ctx, dict):
            return "No prior screening context available."
        lines: list[str] = []

        profile = ctx.get("profile_compact")
        if isinstance(profile, dict) and profile:
            parts = [f"{k}: {v}" for k, v in profile.items()]
            lines.append("User health context: " + "; ".join(parts) + ".")
        else:
            lines.append("User health context: not provided.")

        latest = ctx.get("latest")
        if isinstance(latest, dict):
            date = latest.get("date") or "unknown date"
            risk = latest.get("risk_category") or "unknown risk"
            hb = latest.get("hb_range")
            if isinstance(hb, (list, tuple)) and len(hb) >= 2:
                hb_txt = f"Hb estimate range {hb[0]}-{hb[1]} g/dL (screening estimate, not a lab measurement)"
            else:
                hb_txt = "Hb estimate range unavailable"
            factors = latest.get("key_factors") or []
            if isinstance(factors, list) and factors:
                factor_txt = "key factors: " + ", ".join(str(f) for f in factors[:5])
            else:
                factor_txt = "key factors unavailable"
            lines.append(f"Latest screening ({date}): risk {risk}; {hb_txt}; {factor_txt}.")
        else:
            lines.append("Latest screening: none available.")

        history = ctx.get("history")
        if isinstance(history, list) and history:
            bits: list[str] = []
            for item in history[:5]:
                if isinstance(item, dict):
                    bits.append(
                        f"{item.get('date') or 'unknown date'} — "
                        f"{item.get('risk_category') or 'unknown risk'}"
                    )
            if bits:
                lines.append("Earlier screenings: " + "; ".join(bits) + ".")
            else:
                lines.append("Earlier screenings: none.")
        else:
            lines.append("Earlier screenings: none.")

        return "\n".join(lines)
    except Exception:
        return "No prior screening context available."
