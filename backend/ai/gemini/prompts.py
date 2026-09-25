"""
HemoLens AI — Gemini Prompt Templates & Guardrails
===================================================
Clinical and ethical prompt definitions for HemoLens personalized screening reports.

Guarantees:
- Strict instruction prohibiting alteration of numerical Hb values or clinical cutoffs.
- Mandatory medical disclaimers and recommendation for confirmatory laboratory blood test.
- Zero prescription or therapeutic claims.
"""

from __future__ import annotations

import json
from typing import Any

try:
    from backend.ai.gemini.schemas import ScreeningReportInput
except ModuleNotFoundError:
    from ai.gemini.schemas import ScreeningReportInput


SYSTEM_INSTRUCTION: str = """You are the HemoLens Clinical Report Assistant, an AI health education specialist designed to explain preliminary, non-invasive anaemia screening results to patients in clear, supportive, and medically responsible language.

CRITICAL MEDICAL & ARCHITECTURAL GUARDRAILS:
1. IMMUTABLE BACKEND METRICS: The backend ML model and WHO 2024 deterministic classification engine are the absolute source of truth. You MUST COPY the `overall_hb_level`, `hb_range`, `risk_category`, and `confidence` EXACTLY as provided in the input. NEVER invent, recalculate, alter, or round differently.
2. PRELIMINARY SCREENING, NOT DIAGNOSIS: Explicitly reiterate that HemoLens is a preliminary screening tool and NEVER provides a definitive clinical diagnosis.
3. MANDATORY CONFIRMATORY TESTING: Strongly recommend scheduling an appointment with a qualified physician for a confirmatory venous blood test (Complete Blood Count / CBC and serum ferritin).
4. NO PRESCRIPTION OR DOSING: Do NOT prescribe medications, iron supplements, specific dosages, or medical treatments. General nutritional concepts (e.g., iron-rich foods like leafy greens, lentils, citrus for vitamin C absorption) are permitted for education only.
5. NO FABRICATED LAB VALUES: Do NOT fabricate ferritin, MCV, hematocrit, or other blood panel numbers that were not measured.
6. CAUSAL CLARITY: Distinguish image-derived optical features (conjunctival microvascular pallor) from self-reported symptoms (e.g., fatigue, dizziness). Explain that symptoms can arise from many causes and do not alone prove anemia.
7. EMPATHETIC & ACCESSIBLE TONE: Use compassionate, reassuring, jargon-free language suitable for diverse health literacy levels.

OUTPUT FORMAT:
You MUST respond with valid, structured JSON conforming strictly to the requested schema.
"""


def build_user_prompt(input_data: ScreeningReportInput) -> str:
    """
    Constructs an anonymized, structured prompt containing only trusted data.
    Contains zero sensitive PII, raw image data, or credentials.
    """
    ml = input_data.ml_result
    profile = input_data.user_profile
    symptoms = input_data.symptoms

    # Format reported symptoms list
    active_symptoms: list[str] = []
    if symptoms.fatigue:
        active_symptoms.append("Fatigue / low energy")
    if symptoms.weakness:
        active_symptoms.append("Generalized muscle weakness")
    if symptoms.dizziness:
        active_symptoms.append("Lightheadedness / dizziness")
    if symptoms.pale_skin:
        active_symptoms.append("Visible pale skin or mucosa")
    if symptoms.shortness_of_breath:
        active_symptoms.append("Shortness of breath on mild exertion")
    if symptoms.cold_hands_feet:
        active_symptoms.append("Cold hands or feet")
    if symptoms.headaches:
        active_symptoms.append("Frequent headaches")
    if symptoms.brittle_nails:
        active_symptoms.append("Brittle nails")
    if symptoms.chest_pain:
        active_symptoms.append("Chest discomfort / palpitations")
    if symptoms.other_symptoms:
        active_symptoms.extend(symptoms.other_symptoms)

    symptoms_text = ", ".join(active_symptoms) if active_symptoms else "No specific symptoms reported"

    # Format demographics
    demo_parts: list[str] = []
    if profile.age is not None:
        demo_parts.append(f"Age: {profile.age} years")
    if profile.gender:
        demo_parts.append(f"Biological Sex: {profile.gender}")
    if profile.pregnancy_status and profile.pregnancy_status != "Not applicable":
        demo_parts.append(f"Pregnancy Status: {profile.pregnancy_status}")
    if profile.diet:
        demo_parts.append(f"Dietary Pattern: {profile.diet}")
    if profile.previous_anemia_history:
        demo_parts.append(f"Anemia History: {profile.previous_anemia_history}")
    if profile.medical_conditions:
        demo_parts.append(f"Medical Conditions: {', '.join(profile.medical_conditions)}")

    demographics_text = "; ".join(demo_parts) if demo_parts else "Not specified"

    threshold_info_text = "Standard WHO 2024 guidance"
    if ml.thresholds_applied:
        threshold_info_text = (
            f"Normal cutoff ≥ {ml.thresholds_applied.get('normal_cutoff', 12.0)} g/dL; "
            f"Mild: {ml.thresholds_applied.get('mild_floor', 11.0)}-{ml.thresholds_applied.get('normal_cutoff', 12.0)} g/dL; "
            f"Moderate: {ml.thresholds_applied.get('moderate_floor', 8.0)}-{ml.thresholds_applied.get('mild_floor', 11.0)} g/dL; "
            f"Severe < {ml.thresholds_applied.get('moderate_floor', 8.0)} g/dL"
        )

    prompt = f"""Please generate a personalized, educational HemoLens screening report for this screening session:

--- TRUSTED BACKEND INPUT DATA ---
• Screening Session ID: {input_data.screening_id}
• Estimated Hemoglobin: {ml.hb_estimate:.2f} g/dL (Calibrated Range: {ml.hb_range[0]:.2f} - {ml.hb_range[1]:.2f} g/dL)
• Model Confidence Score: {ml.confidence * 100:.0f}%
• Estimated Anaemia Risk Category: {ml.risk_category.upper()}
• Applicable Reference Population: {ml.applicable_reference_population}
• Applied Clinical Thresholds ({ml.threshold_version}): {threshold_info_text}
• User Demographic Profile: {demographics_text}
• Reported Clinical Symptoms: {symptoms_text}
--- END INPUT DATA ---

Generate a JSON object matching this schema:
{{
  "overall_hb_level": {ml.hb_estimate:.2f},
  "hb_range": [{ml.hb_range[0]:.2f}, {ml.hb_range[1]:.2f}],
  "risk_category": "{ml.risk_category}",
  "confidence": {ml.confidence:.2f},
  "summary": "Clear executive summary of the estimate and context...",
  "result_explanation": "Detailed explanation of conjunctival tissue color analysis and what this Hb level means...",
  "factors_considered": ["Factor 1", "Factor 2", ...],
  "symptoms_considered": ["Symptom 1", ...],
  "health_profile_summary": "How age, sex, diet, and history relate to this screening...",
  "recommended_next_steps": ["Step 1", "Step 2", ...],
  "confirmatory_testing_recommendation": "Clear recommendation for a physician consultation and CBC lab test...",
  "disclaimer": "This is a preliminary screening estimate, not a clinical diagnosis. Anemia must be confirmed through a certified laboratory venous blood test."
}}
"""
    return prompt
