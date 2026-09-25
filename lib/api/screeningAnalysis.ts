/**
 * HemoLens — Canonical Screening Analysis API Client
 * Calls POST /api/screen/analyze on the FastAPI backend.
 *
 * The frontend NEVER computes Hb, classification, or calls Gemini directly.
 * All clinical intelligence lives in the backend; this module is a thin HTTP bridge.
 */

// ─── Types mirroring backend ScreeningAnalysisResponse ─────────────────────

export interface RoiInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  pixel_count: number;
}

export interface ThresholdsApplied {
  mild_lower?: number;
  mild_upper?: number;
  moderate_lower?: number;
  moderate_upper?: number;
  severe_upper?: number;
  normal_lower?: number;
  unit?: string;
  [key: string]: number | string | undefined;
}

export interface ScreeningReportData {
  overall_hb_level?: number;
  hb_range?: [number, number];
  risk_category?: string;
  confidence?: number;
  summary: string;
  result_explanation?: string;
  explanation?: string;
  factors_considered?: string[];
  risk_factors?: string[];
  symptoms_considered?: string[];
  health_profile_summary?: string;
  recommended_next_steps?: string[];
  recommendations?: string[];
  confirmatory_testing_recommendation?: string;
  followup_urgency?: string;
  disclaimer: string;
}

export interface ScreeningAnalysisResponse {
  screening_id: string;
  user_id: string | null;
  status: "complete" | "failed" | "partial";
  analysis_timestamp: string;

  // ML results (immutable source of truth)
  hb_estimate: number;
  hb_range: [number, number];
  model_confidence: number;
  model_version: string;

  // Deterministic WHO 2024 clinical classification
  risk_category: "normal" | "mild" | "moderate" | "severe" | "unclassifiable";
  applicable_reference_population: string;
  threshold_version: string;
  reference_source: string;
  thresholds_applied: ThresholdsApplied | null;
  unclassifiable_reason: string | null;
  disclaimer: string;

  // Gemini personalized report
  report_status: "complete" | "fallback" | "unavailable" | "failed";
  report: ScreeningReportData | null;

  // Supabase persistence
  persisted: boolean;
  persistence_message: string | null;

  // Visual metadata
  roi_info: RoiInfo | null;
  roi_marked_image_base64: string | null;
}

// ─── Analysis stage machine ─────────────────────────────────────────────────

export type AnalysisStage =
  | "idle"
  | "uploading"
  | "validating"
  | "extracting"
  | "analyzing"
  | "generating_report"
  | "completed"
  | "error";

export interface AnalysisProgress {
  stage: AnalysisStage;
  message: string;
}

export const STAGE_LABELS: Record<AnalysisStage, string> = {
  idle: "Ready to analyze",
  uploading: "Uploading image…",
  validating: "Validating image quality…",
  extracting: "Extracting conjunctival features…",
  analyzing: "Running hemoglobin inference…",
  generating_report: "Generating personalized report…",
  completed: "Analysis complete",
  error: "Analysis failed",
};

// ─── API Options ────────────────────────────────────────────────────────────

export interface RunScreeningAnalysisOptions {
  eyelidFile: File | Blob;
  screeningId?: string | null;
  userId?: string | null;
  userAge?: number | null;
  userGender?: string | null;
  pregnancyStatus?: string | null;
  diet?: string | null;
  previousAnemiaHistory?: string | null;
  medicalConditions?: string[] | null;
  symptoms?: { selected?: string[]; other?: string } | null;
  /** If the frontend already validated the image, skip backend re-validation */
  skipValidation?: boolean;
  onProgress?: (progress: AnalysisProgress) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function notifyProgress(
  stage: AnalysisStage,
  cb?: (p: AnalysisProgress) => void
) {
  cb?.({ stage, message: STAGE_LABELS[stage] });
}

// ─── Main API call ──────────────────────────────────────────────────────────

export async function runScreeningAnalysis(
  opts: RunScreeningAnalysisOptions
): Promise<ScreeningAnalysisResponse> {
  const {
    eyelidFile,
    screeningId,
    userId,
    userAge,
    userGender,
    pregnancyStatus,
    diet,
    previousAnemiaHistory,
    medicalConditions,
    symptoms,
    skipValidation = false,
    onProgress,
  } = opts;

  notifyProgress("uploading", onProgress);

  const formData = new FormData();
  formData.append(
    "image",
    eyelidFile,
    eyelidFile instanceof File ? eyelidFile.name : "eyelid.jpg"
  );

  if (screeningId) formData.append("screening_id", screeningId);
  if (userId) formData.append("user_id", userId);
  if (userAge != null) formData.append("user_age", String(userAge));
  if (userGender) formData.append("user_gender", userGender);
  if (pregnancyStatus) formData.append("pregnancy_status", pregnancyStatus);
  if (diet) formData.append("diet", diet);
  if (previousAnemiaHistory)
    formData.append("previous_anemia_history", previousAnemiaHistory);
  if (medicalConditions?.length)
    formData.append("medical_conditions", JSON.stringify(medicalConditions));

  // Map symptom array to backend SymptomsContext dict
  if (symptoms) {
    const selected = symptoms.selected ?? [];
    const symptomsDict: Record<string, boolean | string[]> = {
      fatigue: selected.includes("fatigue"),
      weakness: selected.includes("weakness"),
      dizziness: selected.includes("dizziness"),
      pale_skin: selected.includes("pale_skin"),
      shortness_of_breath: selected.includes("shortness_of_breath"),
      cold_hands_feet: selected.includes("cold_hands_feet"),
      headaches: selected.includes("headaches"),
      brittle_nails: selected.includes("brittle_nails"),
      chest_pain: selected.includes("chest_pain"),
    };
    if (symptoms.other) {
      symptomsDict.other_symptoms = [symptoms.other];
    }
    formData.append("symptoms", JSON.stringify(symptomsDict));
  }

  formData.append("skip_validation", skipValidation ? "true" : "false");
  formData.append("generate_ai_report", "true");

  // Simulate intermediate progress stages during the single long-running request
  notifyProgress("validating", onProgress);

  const timers: ReturnType<typeof setTimeout>[] = [];
  const schedule = (stage: AnalysisStage, delayMs: number) => {
    timers.push(setTimeout(() => notifyProgress(stage, onProgress), delayMs));
  };
  schedule("extracting", 2000);
  schedule("analyzing", 5000);
  schedule("generating_report", 9000);

  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
  const endpoint = backendBase
    ? `${backendBase}/api/screen/analyze`
    : "/api/screen/analyze";

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });
  } finally {
    timers.forEach(clearTimeout);
  }

  if (!response.ok) {
    let detail: {
      code?: string;
      message?: string;
      errors?: { code: string; message: string }[];
    } = {};
    try {
      const body = await response.json();
      detail = body?.detail ?? body ?? {};
    } catch {
      // non-JSON body — ignore
    }

    const msg =
      detail?.errors?.[0]?.message ??
      detail?.message ??
      `Backend returned ${response.status}`;

    throw new Error(msg);
  }

  const data = (await response.json()) as ScreeningAnalysisResponse;
  notifyProgress("completed", onProgress);
  return data;
}
