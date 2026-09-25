"""
HemoLens Clinical — Population Reference Documentation
=======================================================
Human-readable summary of which user profiles map to which WHO population
groups, and what data gaps prevent classification.

This module documents the mapping in code so that it can be tested,
audited, and updated alongside the clinical guidance.
"""

from __future__ import annotations

from typing import Final

# ---------------------------------------------------------------------------
# HemoLens onboarding field coverage vs. WHO requirements
# ---------------------------------------------------------------------------

POPULATION_MAPPING_NOTES: Final[str] = """
HemoLens → WHO Population Group Mapping
========================================

Input fields available from user_profiles (database.types.ts):
  - age           : integer | null
  - gender        : "Female" | "Male" | "Other" | "Prefer not to say" | null
  - pregnancy_status : "Pregnant" | "Not pregnant" | "Not applicable" | null

Supported population groups and their requirements:
  ┌────────────────────────────────────────┬───────────────────────────────┐
  │ WHO Population Group                   │ HemoLens Requirements         │
  ├────────────────────────────────────────┼───────────────────────────────┤
  │ Children 6 months–<5 years (6–59 mo)   │ age ∈ [0, 4]                 │
  │ Children 5–11 years                    │ age ∈ [5, 11]                 │
  │ Children 12–14 years                   │ age ∈ [12, 14]               │
  │ Non-pregnant women ≥15 years           │ age ≥ 15, gender="Female",   │
  │                                        │ pregnancy_status ≠ "Pregnant" │
  │ Pregnant women                         │ age ≥ 15, gender="Female",   │
  │                                        │ pregnancy_status = "Pregnant" │
  │ Men ≥15 years                          │ age ≥ 15, gender="Male"       │
  └────────────────────────────────────────┴───────────────────────────────┘

Known data gaps and their handling:
  - Trimester not collected: Pregnant women receive a single WHO cutoff
    (11.0 g/dL) rather than trimester-adjusted values. The classification
    result documents this limitation in source_note.
  - gender="Other"/"Prefer not to say": Returns UNCLASSIFIABLE with
    explicit reason. No imputation or fallback is applied.
  - age=None: Returns UNCLASSIFIABLE. Never falls back to a default group.
  - age < 6 months (age=0 with <6mo context not available): Returns
    UNCLASSIFIABLE. WHO thresholds for neonates/infants <6mo are not
    implemented.
  - pregnancy_status=None when gender="Female" and age≥15: Treated as
    "Not pregnant" / "Not applicable". Documented in classification result.
"""

THRESHOLD_INTERPRETATION_NOTES: Final[str] = """
Threshold Boundary Rules
=========================
  - Hb exactly equal to normal_cutoff → No Anaemia (NORMAL)
  - Hb exactly equal to mild_floor    → Mild Anaemia
  - Hb exactly equal to moderate_floor → Moderate Anaemia
  - Hb strictly below moderate_floor  → Severe Anaemia

  Tier ranges (g/dL):
    Normal   : Hb ≥ normal_cutoff
    Mild     : mild_floor ≤ Hb < normal_cutoff
    Moderate : moderate_floor ≤ Hb < mild_floor
    Severe   : Hb < moderate_floor

  Classification uses hb_estimate only. The hb_range (uncertainty interval)
  is carried through and displayed for user transparency but does NOT alter
  the classification tier. Gemini is never involved in determining tier.
"""
