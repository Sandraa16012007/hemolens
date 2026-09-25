# HemoLens — AI/ML Pipeline

Concise reference for the end-to-end screening pipeline: image capture → CV → ML → fusion → LLM report.

## 1. Design Principles

- **CV/ML and LLM are strictly separated.** The LLM never computes Hb or risk — it only explains structured numeric output.
- **Eyelid = primary, quantitative model. Nail = optional, lightweight, secondary.**
- **Deterministic checks before ML.** Image validation is pure OpenCV, no training required.
- **Continuous prediction → range.** The model outputs a single Hb value + uncertainty; the app derives the displayed range and risk tier.
- **Symptoms/profile never touch the image model.** They are merged only at the report layer, preserving interpretability.

## 2. Pipeline Stages

### Stage 1 — Frontend Capture (Next.js)
Inputs collected: onboarding profile (age, sex, pregnancy, history), mandatory lower-eyelid image, optional nail-bed image, active symptoms.

### Stage 2 — FastAPI Backend & Processing

**Eyelid CV Pipeline (primary)**
1. `POST /api/screen/validate-image-eyelid` *(Implemented & Integrated)* — Deterministic OpenCV & MediaPipe Tasks pipeline:
   - **Resolution Check:** width ≥ 400px, height ≥ 300px.
   - **Standardized Blur Check:** Variance of Laplacian on 1024px scaled frame ≥ 25.0.
   - **Exposure Window:** Mean grayscale brightness within [30, 235].
   - **Eye Framing & Landmark Check:** MediaPipe FaceLandmarker validates eye width ≥ 300px or ≥ 30% of frame width.
   - **Macro Eyelid / Conjunctiva Fallback:** When whole-face geometry is cropped out, validates biological ocular tissue (R > G & R > B), sclera presence (≥25,000px or ≥8% frame), and exposed palpebral conjunctival mucosa (≥1.5% frame).
   - Fails → returns HTTP 200 with `valid: false` and actionable user guidance; blocks Supabase upload until retaken.
   - Passes → returns HTTP 200 with `valid: true`; enables "Analyze My Screening" trigger.
2. Lower-eyelid ROI extraction (eye/landmark detection or guided crop).
3. Color normalization: RGB → LAB + CLAHE.
4. Resize to 224×224 RGB tensor.

**Nail-Bed CV Pipeline (optional, secondary)**
1. `POST /api/screen/validate-image-nail` *(Implemented & Integrated)* — Deterministic multi-cue OpenCV validation pipeline:
   - **Resolution Check:** width ≥ 400px, height ≥ 300px.
   - **Skin-Edge Sharpness Check:** Sobel gradient Tenengrad on segmented hand/skin regions ≥ 350.0 (prevents blurred/out-of-focus nail shots).
   - **Exposure Window:** Mean grayscale brightness within [30, 235].
   - **Fingernail Count & Visibility Check:** Multi-scale Top-Hat + localized contrast and inclusive skin chrominance segmentation (HSV + YCrCb). Requires **≥ 3 clearly visible fingernails** (each ≥ 0.9% of frame area, solidity ≥ 0.40).
   - **Zoom & Framing Check:** Rejects zoomed-out hand/body shots where individual nails are too small for pallor analysis.
   - Fails → returns HTTP 200 with `valid: false` and retake/skip actions.
   - Passes → returns HTTP 200 with `valid: true` and detected `nail_count`.
2. Nail ROI extraction.
3. Extract RGB/HSV/LAB statistics + red/blue pixel ratios (feature engineering, not deep learning).

### Stage 3 — ML Inference & Clinical Classification

| Model / Layer | Input | Method | Output |
|---|---|---|---|
| Eyelid Hb Model (primary) | 49-dim color/texture vector (`eyelid_49_v1`) | `ExtraTreesRegressor` ensemble (`eyelid_hb_model_v1.joblib`) | `hb_estimate`, `hb_range`, `confidence` |
| Deterministic Clinical Classification | ML `hb_estimate` + Demographics (age, gender, pregnancy) | WHO 2024 Cutoff Guidance (`who_2024_hb_v1`) | `risk_category`, `applicable_reference_population`, `thresholds_applied` |

- **Inference Service:** Thread-safe singleton model bundle loaded once at FastAPI startup.
- **Uncertainty Calibration:** Dynamic error margin computation producing calibrated `hb_range = [hb_estimate - margin, hb_estimate + margin]`.
- **Classification Rules:** Strictly deterministic, versioned WHO 2024 rules (children 6–59m, 5–11y, 12–14y; non-pregnant women; pregnant women; men). LLM is strictly prohibited from altering clinical cutoffs.

### Stage 4 — Context Engine & Report Generation
- Build structured **patient state JSON**: profile + symptoms + deterministic screening result (image evidence and subjective symptoms kept as separate, labeled fields).
- **One LLM call** (Gemini 1.5 Flash / local LLM) converts structured JSON → human-readable clinical report + dietary/lifestyle guidance.

### Stage 5 — Storage & AI Assistant
- Save compact structured summary to Supabase database (`public.screenings`, `public.reports`).
- AI Assistant chatbot: **one LLM call per user question**, using the same structured patient-state context (multi-turn, memory-aware).

## 3. End-to-End Data Flow

```
IMAGE(S) → OpenCV Validate → ROI Extract → 49-dim Feature Extract
        → ML Inference (ExtraTreesRegressor) → {hb_estimate, hb_range, confidence}
        → Deterministic WHO Classification → Risk Tier (Normal / Mild / Moderate / Severe)
        → + Profile + Symptoms → Structured Screening Response
        → 1 LLM call → Structured Screening Report
        → Supabase (save) → AI Assistant (LLM per message)
```

## 4. LLM Call Budget

| Path | LLM calls |
|---|---|
| Image validation + ML inference + WHO Classification | 0 |
| Report generation | 1 |
| Chatbot | 1 per message |

## 5. API Contract (POST /api/screen/analyze)

```json
{
  "screening_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "status": "complete",
  "analysis_timestamp": "2026-09-26T00:50:00.000000+00:00",
  "hb_estimate": 10.13,
  "hb_range": [7.27, 12.99],
  "model_confidence": 0.46,
  "model_version": "eyelid_hb_model_v1",
  "risk_category": "moderate",
  "applicable_reference_population": "Non-pregnant women (≥15 years)",
  "threshold_version": "who_2024_hb_v1",
  "reference_source": "WHO 2024 Guideline on Haemoglobin Cutoffs for Anaemia",
  "thresholds_applied": {
    "normal_cutoff": 12.0,
    "mild_floor": 11.0,
    "moderate_floor": 8.0
  },
  "unclassifiable_reason": null,
  "disclaimer": "This is a preliminary screening estimate, not a clinical diagnosis. Confirm results with a certified laboratory Hb test and consult a healthcare provider.",
  "roi_info": {
    "x": 320,
    "y": 480,
    "width": 420,
    "height": 160,
    "pixel_count": 28400
  },
  "roi_marked_image_base64": "data:image/jpeg;base64,..."
}
```

## 6. Models Used / Datasets

- **Eyelid:** EfficientNet-B0, fine-tuned on **CP-AnemiC** (710 conjunctival images, children 6–59mo) + **Eyes-Defy-Anemia** (218 images, Hb + segmentation masks). Baseline: existing Hugging Face `galihkjaya/anemia-palor-detection` checkpoint.
- **Nail:** Random Forest/XGBoost on RGB/HSV/LAB color-ratio features (only if usable labeled data is available; otherwise API returns `"nail": null`).
- **Splits:** patient-wise (never image-wise), 70/15/15 or 5-fold CV if data is small.
- **Metrics:** classification — accuracy, precision, recall, specificity, F1, ROC-AUC; regression — MAE, RMSE, R², Pearson r, Bland–Altman.