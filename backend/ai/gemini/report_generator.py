"""
HemoLens AI — Canonical Screening Report Generator Service
==========================================================
Isolated report generation service connecting ML inference & deterministic
classification results with Google Gemini AI for personalized patient education.

Architectural Guarantees:
1. Strict 1-call limit per report (no retry loops or duplicate API calls).
2. Backend is the immutable source of truth: ML numbers and risk categories are
   always anchored to backend calculations and cannot be overwritten by LLM.
3. Safe fallback generation: if Gemini fails or is unconfigured, returns a clean
   structured report with appropriate status without crashing the screening pipeline.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

try:
    from backend.ai.gemini.client import (
        get_gemini_client,
        get_gemini_model_name,
        is_gemini_configured,
    )
    from backend.ai.gemini.prompts import SYSTEM_INSTRUCTION, build_user_prompt
    from backend.ai.gemini.schemas import (
        ReportGenerationResponse,
        ReportGenerationStatus,
        ScreeningReportData,
        ScreeningReportInput,
    )
except ModuleNotFoundError:
    from ai.gemini.client import (
        get_gemini_client,
        get_gemini_model_name,
        is_gemini_configured,
    )
    from ai.gemini.prompts import SYSTEM_INSTRUCTION, build_user_prompt
    from ai.gemini.schemas import (
        ReportGenerationResponse,
        ReportGenerationStatus,
        ScreeningReportData,
        ScreeningReportInput,
    )

logger = logging.getLogger(__name__)

MANDATORY_DISCLAIMER: str = (
    "This is an AI-powered preliminary screening estimate, not a clinical diagnosis. "
    "Do not start, stop, or change any medication or supplement without consulting a qualified physician. "
    "Anemia must be confirmed through a certified laboratory venous blood test (Complete Blood Count / CBC)."
)


def _build_deterministic_fallback_report(
    input_data: ScreeningReportInput,
) -> ScreeningReportData:
    """
    Constructs a deterministic, medically-sound educational report
    when the LLM service is unavailable, offline, or returns malformed data.
    """
    ml = input_data.ml_result
    profile = input_data.user_profile
    symptoms = input_data.symptoms
    risk = ml.risk_category.lower()

    # Active symptoms list
    active_symptoms: list[str] = []
    if symptoms.fatigue:
        active_symptoms.append("Fatigue / low energy")
    if symptoms.weakness:
        active_symptoms.append("Generalized muscle weakness")
    if symptoms.dizziness:
        active_symptoms.append("Lightheadedness / dizziness")
    if symptoms.pale_skin:
        active_symptoms.append("Noticeable pale skin or mucosa")
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

    # Risk-tailored summary and explanation
    if risk == "normal":
        summary = (
            f"Your estimated hemoglobin level of {ml.hb_estimate:.1f} g/dL falls within the expected "
            f"normal range for {ml.applicable_reference_population}. Optical analysis of the lower eyelid "
            f"conjunctiva shows healthy microvascular vascularization."
        )
        explanation = (
            "The palpebral conjunctiva tissue inside your lower eyelid demonstrates normal spectral reflectance, "
            "indicating adequate red blood cell microvascular density. While this preliminary screening is reassuring, "
            "it is not a substitute for standard clinical blood evaluations."
        )
        next_steps = [
            "Maintain a balanced, nutrient-dense diet rich in iron, vitamin B12, and folate.",
            "Continue regular routine health check-ups with your healthcare provider.",
            "Repeat a screening in 3 to 6 months or whenever you experience unusual fatigue.",
        ]
    elif risk == "mild":
        summary = (
            f"Your estimated hemoglobin level of {ml.hb_estimate:.1f} g/dL indicates a mild anaemia risk "
            f"according to WHO {ml.applicable_reference_population} guidelines. "
            f"A confirmatory blood test is recommended."
        )
        explanation = (
            "Spectral analysis of your conjunctival tissue detected slight mucosal pallor, which can correlate with "
            "subtle reductions in circulating hemoglobin. Mild anemia often develops gradually and may be associated "
            "with nutritional factors, iron depletion, or physiological demands."
        )
        next_steps = [
            "Schedule a routine consultation with your physician to discuss this screening result.",
            "Request a confirmatory Complete Blood Count (CBC) and serum ferritin test.",
            "Review dietary iron sources (e.g. dark leafy greens, legumes, lean meats) and pair with vitamin C.",
            "Avoid self-prescribing iron supplements before receiving laboratory confirmation.",
        ]
    elif risk == "moderate":
        summary = (
            f"Your estimated hemoglobin level of {ml.hb_estimate:.1f} g/dL suggests a moderate risk of anaemia. "
            f"Prompt medical evaluation and a laboratory blood test are strongly advised."
        )
        explanation = (
            "Optical conjunctival analysis indicates noticeable mucosal pallor, consistent with decreased microvascular "
            "hemoglobin density. When red blood cell volume is diminished, mucosal capillary beds reflect less red spectrum light."
        )
        next_steps = [
            "Schedule a prompt appointment with a healthcare provider or primary care clinic.",
            "Undergo a diagnostic venous blood panel (CBC, serum iron, ferritin, and total iron-binding capacity).",
            "Discuss any persistent symptoms (such as fatigue or lightheadedness) with your doctor.",
            "Refrain from taking high-dose iron supplements without professional medical guidance.",
        ]
    elif risk == "severe":
        summary = (
            f"Your estimated hemoglobin level of {ml.hb_estimate:.1f} g/dL indicates a significant risk of severe anaemia. "
            f"Please seek urgent clinical evaluation by a medical professional."
        )
        explanation = (
            "Marked pallor was detected across the palpebral conjunctiva, suggesting substantially reduced microvascular "
            "hemoglobin reflection. Severe anemia warrants immediate diagnostic investigation to determine the underlying cause."
        )
        next_steps = [
            "Seek urgent medical evaluation at a healthcare center or primary care provider.",
            "Obtain immediate laboratory diagnostic testing (Complete Blood Count and comprehensive metabolic panel).",
            "If experiencing severe shortness of breath, chest pain, or fainting, seek emergency medical care immediately.",
        ]
    else:  # unclassifiable
        summary = (
            f"An estimated hemoglobin level of {ml.hb_estimate:.1f} g/dL was calculated, but clinical risk classification "
            f"is unavailable due to incomplete demographic context."
        )
        explanation = (
            f"WHO hemoglobin cutoffs vary by age, biological sex, and pregnancy status. "
            f"{ml.unclassifiable_reason or 'Please complete your health profile to enable full risk categorization.'}"
        )
        next_steps = [
            "Update your age and biological sex in your HemoLens health profile.",
            "Consult a healthcare provider for a personalized clinical evaluation and blood test.",
        ]

    factors = [
        "Lower eyelid conjunctival microvascular optical reflectance",
        f"WHO 2024 population guidelines ({ml.applicable_reference_population})",
    ]
    if profile.diet:
        factors.append(f"Dietary pattern ({profile.diet})")
    if active_symptoms:
        factors.append(f"Self-reported symptoms ({len(active_symptoms)} reported)")

    demo_summary = f"Profile: {profile.gender or 'Sex unstated'}, Age: {profile.age if profile.age is not None else 'Unstated'}"
    if profile.pregnancy_status and profile.pregnancy_status != "Not applicable":
        demo_summary += f", Pregnancy: {profile.pregnancy_status}"
    if profile.diet:
        demo_summary += f", Diet: {profile.diet}"

    return ScreeningReportData(
        overall_hb_level=ml.hb_estimate,
        hb_range=ml.hb_range,
        risk_category=ml.risk_category,
        confidence=ml.confidence,
        summary=summary,
        result_explanation=explanation,
        factors_considered=factors,
        symptoms_considered=active_symptoms if active_symptoms else ["None reported"],
        health_profile_summary=demo_summary,
        recommended_next_steps=next_steps,
        confirmatory_testing_recommendation=(
            "Schedule a laboratory Complete Blood Count (CBC) and serum ferritin test with your physician "
            "to definitively assess and confirm your hemoglobin levels."
        ),
        disclaimer=MANDATORY_DISCLAIMER,
    )


def _python_hindi_fallback_translation(report: ScreeningReportData) -> ScreeningReportData:
    """
    Fallback Python translator that converts English report fields to Hindi
    when Gemini API is offline or unconfigured.
    """
    summary = report.summary
    explanation = report.result_explanation
    disclaimer = report.disclaimer
    confirmatory = report.confirmatory_testing_recommendation

    # Standard summary fallback translations
    if "falls within the expected normal range" in summary or "normal range" in summary:
        summary = f"आपका अनुमानित हीमोग्लोबिन स्तर {report.overall_hb_level:.1f} g/dL सामान्य सीमा के भीतर है। पलक के कंजंक्टिवा के ऑप्टिकल विश्लेषण से स्वस्थ सूक्ष्म वाहिकाएं दिखाई देती हैं।"
    elif "mild anaemia risk" in summary or "mild" in summary:
        summary = f"आपका अनुमानित हीमोग्लोबिन स्तर {report.overall_hb_level:.1f} g/dL डब्ल्यूएचओ के दिशा-निर्देशों के अनुसार हल्के एनीमिया जोखिम का संकेत देता है। एक पुष्टि रक्त परीक्षण की सिफारिश की जाती है।"
    elif "moderate risk of anaemia" in summary or "moderate" in summary:
        summary = f"आपका अनुमानित हीमोग्लोबिन स्तर {report.overall_hb_level:.1f} g/dL मध्यम एनीमिया जोखिम का सुझाव देता है। तुरंत डॉक्टर से परामर्श और रक्त परीक्षण की सलाह दी जाती है।"
    elif "severe anaemia" in summary or "severe" in summary:
        summary = f"आपका अनुमानित हीमोग्लोबिन स्तर {report.overall_hb_level:.1f} g/dL गंभीर एनीमिया का उच्च जोखिम दर्शाता है। कृपया तुरंत चिकित्सा सहायता प्राप्त करें।"
    else:
        summary = f"अनुमानित हीमोग्लोबिन स्तर {report.overall_hb_level:.1f} g/dL की गणना की गई है। विस्तृत नैदानिक वर्गीकरण उपलब्ध है।"

    # Result explanation translations
    if "normal spectral reflectance" in explanation:
        explanation = "आपकी निचली पलक के भीतर कंजंक्टिवा ऊतक सामान्य स्पेक्ट्रल परावर्तन प्रदर्शित करता है, जो पर्याप्त लाल रक्त कोशिका सूक्ष्म संवाहन घनत्व को दर्शाता है।"
    elif "detected slight mucosal pallor" in explanation:
        explanation = "आपके कंजंक्टिवल ऊतक के स्पेक्ट्रल विश्लेषण में हल्का पीलापन पाया गया, जो हीमोग्लोबिन में मामूली कमी से संबंधित हो सकता है।"
    elif "noticeable mucosal pallor" in explanation:
        explanation = "ऑप्टिकल कंजंक्टिवल विश्लेषण से स्पष्ट पीलापन दिखाई देता है, जो सूक्ष्म संवहनी हीमोग्लोबिन घनत्व में कमी के अनुकूल है।"
    elif "Marked pallor" in explanation:
        explanation = "कंजंक्टिवा में महत्वपूर्ण पीलापन पाया गया, जो सूक्ष्म संवहनी हीमोग्लोबिन में भारी कमी का संकेत देता है।"

    # Factors translation
    translated_factors = []
    for f in report.factors_considered:
        if "optical reflectance" in f.lower():
            translated_factors.append("निचली पलक के कंजंक्टिवा ऑप्टिकल घनत्व विश्लेषण")
        elif "who" in f.lower():
            translated_factors.append("डब्ल्यूएचओ 2024 जनसंख्या दिशा-निर्देश")
        elif "diet" in f.lower():
            translated_factors.append("आहार पैटर्न")
        elif "symptoms" in f.lower():
            translated_factors.append("स्व-रिपोर्ट किए गए लक्षण")
        else:
            translated_factors.append(f)

    # Next steps translation
    translated_next_steps = []
    for step in report.recommended_next_steps:
        if "iron-rich" in step.lower() or "nutrient-dense" in step.lower():
            translated_next_steps.append("आयरन, विटामिन बी12 और फोलेट से भरपूर संतुलित आहार बनाए रखें।")
        elif "routine" in step.lower() or "check-up" in step.lower():
            translated_next_steps.append("अपने स्वास्थ्य देखभाल प्रदाता के साथ नियमित स्वास्थ्य जांच जारी रखें।")
        elif "consultation" in step.lower() or "schedule" in step.lower():
            translated_next_steps.append("इस स्क्रीनिंग परिणाम पर चर्चा करने के लिए अपने डॉक्टर के साथ परामर्श का समय निर्धारित करें।")
        elif "laboratory" in step.lower() or "blood test" in step.lower() or "cbc" in step.lower():
            translated_next_steps.append("पुष्टि के लिए पूर्ण रक्त गणना (सीबीसी) और सीरम फेरिटिन परीक्षण करवाएं।")
        elif "urgent" in step.lower() or "emergency" in step.lower():
            translated_next_steps.append("स्वास्थ्य केंद्र या प्राथमिक देखभाल प्रदाता पर तत्काल चिकित्सा मूल्यांकन प्राप्त करें।")
        else:
            translated_next_steps.append(step)

    disclaimer = (
        "यह एक एआई-संचालित प्रारंभिक जांच अनुमान है, नैदानिक निदान नहीं। "
        "योग्य चिकित्सक से परामर्श किए बिना कोई भी दवा या सप्लीमेंट शुरू, बंद या न बदलें। "
        "एनीमिया की पुष्टि प्रयोगशाला शिरापरक रक्त परीक्षण (सीबीसी) द्वारा की जानी चाहिए।"
    )

    confirmatory = "अपने हीमोग्लोबिन के स्तर की निश्चित रूप से पुष्टि करने के लिए अपने डॉक्टर से प्रयोगशाला सीबीसी और सीरम फेरिटिन परीक्षण शेड्यूल करें।"

    return ScreeningReportData(
        overall_hb_level=report.overall_hb_level,
        hb_range=report.hb_range,
        risk_category=report.risk_category,
        confidence=report.confidence,
        summary=summary,
        result_explanation=explanation,
        factors_considered=translated_factors if translated_factors else report.factors_considered,
        symptoms_considered=report.symptoms_considered,
        health_profile_summary=report.health_profile_summary,
        recommended_next_steps=translated_next_steps if translated_next_steps else report.recommended_next_steps,
        confirmatory_testing_recommendation=confirmatory,
        disclaimer=disclaimer,
    )


def _translate_report_data_with_gemini(
    client: Any,
    report: ScreeningReportData,
    model_name: str,
) -> ScreeningReportData:
    """
    Step 2 in Generate-then-Translate pipeline:
    Translates the generated English narrative fields into Devanagari Hindi via a targeted Gemini call.
    """
    payload_to_translate = {
        "summary": report.summary,
        "result_explanation": report.result_explanation,
        "factors_considered": report.factors_considered,
        "symptoms_considered": report.symptoms_considered,
        "health_profile_summary": report.health_profile_summary,
        "recommended_next_steps": report.recommended_next_steps,
        "confirmatory_testing_recommendation": report.confirmatory_testing_recommendation,
        "disclaimer": report.disclaimer,
    }

    translation_prompt = (
        "You are an expert clinical translator for HemoLens. Translate the narrative strings in the following JSON "
        "object into clear, natural, compassionate Hindi written strictly in Devanagari script.\n\n"
        "RULES:\n"
        "1. Preserve JSON keys and structure EXACTLY.\n"
        "2. Do NOT change numbers, units (g/dL), or blood test names (CBC, Ferritin).\n"
        "3. Output MUST be valid JSON matching the exact input structure.\n\n"
        f"INPUT JSON TO TRANSLATE:\n{json.dumps(payload_to_translate, indent=2)}"
    )

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=translation_prompt,
            config={
                "response_mime_type": "application/json",
                "temperature": 0.1,
            },
        )
        response_text = response.text or ""
        if not response_text.strip():
            raise ValueError("Empty translation response received from Gemini.")

        translated_json = json.loads(response_text)

        return ScreeningReportData(
            overall_hb_level=report.overall_hb_level,
            hb_range=report.hb_range,
            risk_category=report.risk_category,
            confidence=report.confidence,
            summary=str(translated_json.get("summary", report.summary)).strip(),
            result_explanation=str(translated_json.get("result_explanation", report.result_explanation)).strip(),
            factors_considered=list(translated_json.get("factors_considered", report.factors_considered)),
            symptoms_considered=list(translated_json.get("symptoms_considered", report.symptoms_considered)),
            health_profile_summary=str(translated_json.get("health_profile_summary", report.health_profile_summary)).strip(),
            recommended_next_steps=list(translated_json.get("recommended_next_steps", report.recommended_next_steps)),
            confirmatory_testing_recommendation=str(translated_json.get("confirmatory_testing_recommendation", report.confirmatory_testing_recommendation)).strip(),
            disclaimer=str(translated_json.get("disclaimer", report.disclaimer)).strip(),
        )
    except Exception as exc:
        logger.warning("Gemini 2nd-step translation call failed (%s); using Python Hindi fallback.", exc)
        return _python_hindi_fallback_translation(report)


def generate_screening_report(
    input_data: ScreeningReportInput,
) -> ReportGenerationResponse:
    """
    Canonical report generation entry point with 2-step Generate-then-Translate pipeline.
    1. Always generates core clinical report in English first (ensuring schema & clinical metric integrity).
    2. If target language is 'hi', translates narrative fields via a 2nd targeted Gemini call (or fallback).

    Args:
        input_data: Trusted ScreeningReportInput containing ML metrics, profile, and symptoms.

    Returns:
        ReportGenerationResponse containing the structured report and generation status.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    ml = input_data.ml_result
    target_language = (input_data.language or "en").lower()

    # Create an English-forced input data for Step 1 generation
    english_input_data = input_data.model_copy(update={"language": "en"})

    # -----------------------------------------------------------------------
    # Step 1: Check client configuration
    # -----------------------------------------------------------------------
    client = get_gemini_client()
    if client is None:
        logger.info(
            "Gemini AI client not active for screening %s; returning deterministic fallback report.",
            input_data.screening_id,
        )
        fallback_data = _build_deterministic_fallback_report(english_input_data)
        if target_language == "hi":
            fallback_data = _python_hindi_fallback_translation(fallback_data)

        return ReportGenerationResponse(
            screening_id=input_data.screening_id,
            status=ReportGenerationStatus.UNAVAILABLE,
            report=fallback_data,
            generated_at=now_iso,
            llm_model=None,
            error_message="Gemini API is not configured. Deterministic clinical report generated.",
        )

    # -----------------------------------------------------------------------
    # Step 2: Execute Step 1 Gemini call in English
    # -----------------------------------------------------------------------
    model_name = get_gemini_model_name()
    user_prompt = build_user_prompt(english_input_data)

    # Models to try in order — primary then stable fallback
    models_to_try = [model_name]
    if model_name != "gemini-2.0-flash":
        models_to_try.append("gemini-2.0-flash")
    if "gemini-1.5-flash" not in models_to_try:
        models_to_try.append("gemini-1.5-flash")

    last_exc: Exception | None = None
    used_model: str | None = None
    report_data: ScreeningReportData | None = None

    for attempt_model in models_to_try:
        try:
            logger.info(
                "Requesting AI screening report from Gemini (%s) in English for screening %s...",
                attempt_model,
                input_data.screening_id,
            )
            response = client.models.generate_content(
                model=attempt_model,
                contents=user_prompt,
                config={
                    "system_instruction": SYSTEM_INSTRUCTION,
                    "response_mime_type": "application/json",
                    "temperature": 0.2,
                },
            )

            response_text = response.text or ""
            if not response_text.strip():
                raise ValueError("Empty response received from Gemini model.")

            parsed_json = json.loads(response_text)
            used_model = attempt_model

            # Build report data from LLM JSON (in English)
            report_data = ScreeningReportData(
                overall_hb_level=ml.hb_estimate,  # Enforce backend truth
                hb_range=ml.hb_range,              # Enforce backend truth
                risk_category=ml.risk_category,    # Enforce backend truth
                confidence=ml.confidence,          # Enforce backend truth
                summary=str(parsed_json.get("summary", "")).strip() or _build_deterministic_fallback_report(english_input_data).summary,
                result_explanation=str(parsed_json.get("result_explanation", "")).strip() or _build_deterministic_fallback_report(english_input_data).result_explanation,
                factors_considered=list(parsed_json.get("factors_considered", [])) or ["Conjunctival microvascular pallor", f"WHO guidance ({ml.applicable_reference_population})"],
                symptoms_considered=list(parsed_json.get("symptoms_considered", [])) or ["Symptoms evaluated in context"],
                health_profile_summary=str(parsed_json.get("health_profile_summary", "")).strip() or "Profile reviewed in context.",
                recommended_next_steps=list(parsed_json.get("recommended_next_steps", [])) or _build_deterministic_fallback_report(english_input_data).recommended_next_steps,
                confirmatory_testing_recommendation=str(parsed_json.get("confirmatory_testing_recommendation", "")).strip() or _build_deterministic_fallback_report(english_input_data).confirmatory_testing_recommendation,
                disclaimer=MANDATORY_DISCLAIMER,
            )
            break

        except Exception as exc:
            is_overload = "503" in str(exc) or "UNAVAILABLE" in str(exc) or "overloaded" in str(exc).lower()
            last_exc = exc
            if is_overload and attempt_model != models_to_try[-1]:
                logger.warning(
                    "Gemini model %s is overloaded (503) for %s. Retrying with next model...",
                    attempt_model,
                    input_data.screening_id,
                )
                continue
            else:
                logger.warning(
                    "Gemini API report generation failed for %s on model %s (%s).",
                    input_data.screening_id,
                    attempt_model,
                    exc,
                )
                break

    if report_data is None:
        # All models exhausted — use deterministic fallback
        fallback_data = _build_deterministic_fallback_report(english_input_data)
        if target_language == "hi":
            fallback_data = _python_hindi_fallback_translation(fallback_data)

        return ReportGenerationResponse(
            screening_id=input_data.screening_id,
            status=ReportGenerationStatus.FALLBACK,
            report=fallback_data,
            generated_at=now_iso,
            llm_model=model_name,
            error_message=f"AI generation failed ({type(last_exc).__name__}: {last_exc}). Deterministic clinical report generated.",
        )

    # -----------------------------------------------------------------------
    # Step 3: Targeted Translation Step (if language == "hi")
    # -----------------------------------------------------------------------
    if target_language == "hi":
        logger.info("Executing Step 2 targeted translation to Hindi for screening %s...", input_data.screening_id)
        report_data = _translate_report_data_with_gemini(client, report_data, used_model or model_name)

    logger.info("Gemini screening report generated successfully for %s (model: %s, lang: %s).", input_data.screening_id, used_model, target_language)
    return ReportGenerationResponse(
        screening_id=input_data.screening_id,
        status=ReportGenerationStatus.COMPLETE,
        report=report_data,
        generated_at=now_iso,
        llm_model=used_model,
        error_message=None,
    )

