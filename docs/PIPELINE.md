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
1. `POST /api/screen/validate-image` — OpenCV checks: resolution (≥640×480), blur (variance of Laplacian), brightness/exposure.
   - Fails → return error, prompt retake.
   - Passes → continue.
2. Lower-eyelid ROI extraction (eye/landmark detection or guided crop).
3. Color normalization: RGB → LAB + CLAHE.
4. Resize to 224×224 RGB tensor.

**Nail-Bed CV Pipeline (optional, secondary)**
1. Nail image upload.
2. Nail ROI extraction.
3. Extract RGB/HSV/LAB statistics + red/blue pixel ratios (feature engineering, not deep learning).

### Stage 3 — ML Models

| Model | Input | Method | Output |
|---|---|---|---|
| Eyelid model (primary) | 224×224 normalized ROI | EfficientNet-B0 (ImageNet-pretrained) → 1280-dim feature vector → dual head | `hb_estimate`, `anemia_probability` |
| Nail model (secondary) | Color feature vector | Random Forest / XGBoost | `hb_estimate`, `confidence` |

- **Classification head:** linear + sigmoid → P(anemia). Loss: Binary Cross-Entropy.
- **Regression head:** linear → continuous Hb value. Loss: MSE.
- **Confidence/uncertainty:** ensemble spread or tree-prediction dispersion — explicitly "model confidence," not clinical confidence.

### Stage 4 — Result Fusion
- If only eyelid ran → `overall_hb = eyelid_hb`.
- If both ran → confidence-weighted fusion:
  ```
  overall_hb = (eyelid_hb * eyelid_conf + nail_hb * nail_conf) / (eyelid_conf + nail_conf)
  ```
- Apply uncertainty buffer (e.g. ±0.5 g/dL) → final Hb range.
- Map to risk tier: **Normal / Mild / Moderate / Severe** (context-aware, not one universal threshold).
- Compute overall model confidence score.

### Stage 5 — Context Engine & Report Generation
- Build a structured **patient state JSON**: profile + symptoms + latest screening result (image evidence and subjective symptoms kept as separate, labeled fields).
- **One LLM call** (local Ollama — Qwen2.5 / Gemma2 / Llama3) converts structured JSON → human-readable clinical report + dietary/lifestyle guidance.

### Stage 6 — Storage & AI Assistant
- Save compact structured summary (not raw report) to Supabase.
- AI Assistant chatbot: **one LLM call per user question**, using the same structured patient-state context (multi-turn, memory-aware).

## 3. End-to-End Data Flow

```
IMAGE(S) → OpenCV Validate → ROI Extract → Normalize
        → ML Model(s) (EfficientNet-B0 / RF-XGBoost)
        → {hb_estimate, anemia_probability, confidence}
        → Confidence-weighted Fusion → Hb Range + Risk Tier
        → + Profile + Symptoms → Structured Patient State
        → 1 LLM call → Screening Report
        → Supabase (save) → AI Assistant (LLM per message)
```

## 4. LLM Call Budget

| Path | LLM calls |
|---|---|
| Image validation + ML inference | 0 |
| Report generation | 1 |
| Chatbot | 1 per message |

## 5. API Contract (MVP)

```json
POST /api/screen/analyze
{
  "eyelid": { "hb_estimate": 10.65, "hb_range": [10.1, 11.2], "anemia_probability": 0.78, "confidence": 0.73 },
  "nail": null,
  "overall": { "hb_range": [10.1, 11.2], "risk": "moderate", "confidence": 0.73 }
}
```

## 6. Models Used / Datasets

- **Eyelid:** EfficientNet-B0, fine-tuned on **CP-AnemiC** (710 conjunctival images, children 6–59mo) + **Eyes-Defy-Anemia** (218 images, Hb + segmentation masks). Baseline: existing Hugging Face `galihkjaya/anemia-palor-detection` checkpoint.
- **Nail:** Random Forest/XGBoost on RGB/HSV/LAB color-ratio features (only if usable labeled data is available; otherwise API returns `"nail": null`).
- **Splits:** patient-wise (never image-wise), 70/15/15 or 5-fold CV if data is small.
- **Metrics:** classification — accuracy, precision, recall, specificity, F1, ROC-AUC; regression — MAE, RMSE, R², Pearson r, Bland–Altman.