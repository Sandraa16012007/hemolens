"""
HemoLens Clinical — WHO Haemoglobin Thresholds & References
============================================================
Versioned, deterministic WHO haemoglobin cutoff values for anaemia
classification by population group.

Reference:
    World Health Organization (2024).
    "Haemoglobin concentrations for the diagnosis of anaemia and assessment
    of severity." Vitamin and Mineral Nutrition Information System.
    WHO/NMH/NHD/MNM/11.1. Geneva: World Health Organization.
    URL: https://www.who.int/publications/i/item/WHO-NMH-NHD-MNM-11.1

    Supplemented by:
    WHO (2011). "Haemoglobin concentrations for the diagnosis of anaemia
    and assessment of severity." WHO/NMH/NHD/MNM/11.1.

    Note: The 2024 guidance retains the core population-group cutoffs
    from the 2011 reference document. Values are in g/dL.

Threshold Logic:
    Anaemia is present when Hb is BELOW the applicable normal cutoff.
    Severity tiers (mild/moderate/severe) are defined by sub-ranges
    below the normal threshold.

    ┌─────────────┬─────────────────────────────────────────────┐
    │ Category    │ Definition                                  │
    ├─────────────┼─────────────────────────────────────────────┤
    │ No Anaemia  │ Hb ≥ normal_cutoff                          │
    │ Mild        │ mild_floor ≤ Hb < normal_cutoff             │
    │ Moderate    │ moderate_floor ≤ Hb < mild_floor            │
    │ Severe      │ Hb < moderate_floor                         │
    └─────────────┴─────────────────────────────────────────────┘

    All boundary comparisons are: threshold exclusive on lower end.
    (Hb exactly equal to the normal cutoff → No Anaemia)

Version:
    THRESHOLD_SCHEMA_VERSION = "who_2024_hb_v1"
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Final

THRESHOLD_SCHEMA_VERSION: Final[str] = "who_2024_hb_v1"

REFERENCE_SOURCE: Final[str] = (
    "World Health Organization. (2024). Haemoglobin concentrations for the "
    "diagnosis of anaemia and assessment of severity. "
    "WHO/NMH/NHD/MNM/11.1. Geneva: WHO. "
    "https://www.who.int/publications/i/item/WHO-NMH-NHD-MNM-11.1"
)


@dataclass(frozen=True)
class HbThresholdSet:
    """
    Immutable WHO Hb threshold set for a specific population group.

    Attributes:
        population_label: Human-readable population description.
        normal_cutoff:   Hb (g/dL) at or above which no anaemia is classified.
        mild_floor:      Hb (g/dL) at or above which mild anaemia is classified
                         (and below normal_cutoff).
        moderate_floor:  Hb (g/dL) at or above which moderate anaemia is classified
                         (and below mild_floor).
        severe_ceiling:  Equal to moderate_floor; Hb strictly below this → severe.
    """
    population_label: str
    normal_cutoff: float   # Hb ≥ this → No Anaemia
    mild_floor: float      # mild_floor ≤ Hb < normal_cutoff → Mild
    moderate_floor: float  # moderate_floor ≤ Hb < mild_floor → Moderate
                           # Hb < moderate_floor → Severe
    source_note: str = field(default="", compare=False)


# ---------------------------------------------------------------------------
# WHO 2024 Threshold Sets (g/dL)
# ---------------------------------------------------------------------------
# All values as published in WHO/NMH/NHD/MNM/11.1 Table 1.

# Children 6–59 months
WHO_CHILD_6_59M = HbThresholdSet(
    population_label="Children 6–59 months",
    normal_cutoff=11.0,
    mild_floor=10.0,
    moderate_floor=7.0,
    source_note="WHO 2024 Table 1: Children 6–59 months, altitude-unadjusted sea level.",
)

# Children 5–11 years
WHO_CHILD_5_11Y = HbThresholdSet(
    population_label="Children 5–11 years",
    normal_cutoff=11.5,
    mild_floor=11.0,
    moderate_floor=8.0,
    source_note="WHO 2024 Table 1: Children 5–11 years.",
)

# Children 12–14 years
WHO_CHILD_12_14Y = HbThresholdSet(
    population_label="Children 12–14 years",
    normal_cutoff=12.0,
    mild_floor=11.0,
    moderate_floor=8.0,
    source_note="WHO 2024 Table 1: Children 12–14 years.",
)

# Non-pregnant women 15+ years
WHO_NON_PREGNANT_WOMEN = HbThresholdSet(
    population_label="Non-pregnant women (≥15 years)",
    normal_cutoff=12.0,
    mild_floor=11.0,
    moderate_floor=8.0,
    source_note="WHO 2024 Table 1: Non-pregnant women ≥15 years.",
)

# Pregnant women (any trimester — trimester-level sub-classification not
# supported in this onboarding model; a single cutoff is used per WHO guidance)
WHO_PREGNANT_WOMEN = HbThresholdSet(
    population_label="Pregnant women (any trimester)",
    normal_cutoff=11.0,
    mild_floor=10.0,
    moderate_floor=7.0,
    source_note=(
        "WHO 2024 Table 1: Pregnant women. Note: WHO defines the same "
        "normal cutoff across all trimesters (11.0 g/dL); trimester-specific "
        "physiological adjustments are documented separately but are NOT "
        "applied here because HemoLens onboarding does not collect trimester data."
    ),
)

# Men 15+ years
WHO_MEN = HbThresholdSet(
    population_label="Men (≥15 years)",
    normal_cutoff=13.0,
    mild_floor=11.0,
    moderate_floor=8.0,
    source_note="WHO 2024 Table 1: Men ≥15 years.",
)
