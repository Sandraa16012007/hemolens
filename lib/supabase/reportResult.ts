import type { Report } from "@/types/database.types";
import type { Json } from "@/types/database.types";

export interface MLPrediction {
  hb_estimate: number;
  hb_range: [number, number];
  confidence: number;
  model_version: string;
}

export interface ClinicalClassification {
  risk_category: "normal" | "mild" | "moderate" | "severe" | "unclassifiable";
  applicable_population: string;
  threshold_version: string;
  reference_source: string;
  thresholds_applied: Record<string, number | string> | null;
  unclassifiable_reason: string | null;
  disclaimer: string;
}

export interface NarrativeReport {
  summary: string;
  explanation: string;
  risk_factors: string[];
  recommendations: string[];
  followup_urgency: string;
  disclaimer: string;
}

export interface ParsedReportResult {
  ml_prediction: MLPrediction | null;
  clinical_classification: ClinicalClassification | null;
  narrative_report: NarrativeReport | null;
}

/**
 * Safely parse the JSONB `result` column from a `reports` table row into
 * strongly-typed sub-objects. Returns nulls for each section when data is absent.
 */
export function parseReportResult(report: Report | null): ParsedReportResult {
  if (!report?.result) {
    return {
      ml_prediction: null,
      clinical_classification: null,
      narrative_report: null,
    };
  }

  const result = report.result as Record<string, Json>;

  const ml = (result.ml_prediction ?? null) as Record<string, Json> | null;
  const cc = (result.clinical_classification ?? null) as Record<string, Json> | null;
  const nr = (result.narrative_report ?? null) as Record<string, Json> | null;

  let parsedMl: MLPrediction | null = null;
  if (ml && typeof ml === "object") {
    let hb_range: [number, number] | null = null;
    const rawHbRange = ml.hb_range;
    if (Array.isArray(rawHbRange) && rawHbRange.length >= 2) {
      const low = Number(rawHbRange[0]);
      const high = Number(rawHbRange[1]);
      if (!Number.isNaN(low) && !Number.isNaN(high)) {
        hb_range = [low, high];
      }
    } else if (ml.hb_lower_bound != null && ml.hb_upper_bound != null) {
      const low = Number(ml.hb_lower_bound);
      const high = Number(ml.hb_upper_bound);
      if (!Number.isNaN(low) && !Number.isNaN(high)) {
        hb_range = [low, high];
      }
    }

    const hb_estimate = Number(ml.hb_estimate ?? (result.hb_estimate != null ? result.hb_estimate : NaN));
    const confidence = Number(ml.confidence ?? ml.model_confidence ?? (result.model_confidence != null ? result.model_confidence : NaN));

    if (!Number.isNaN(hb_estimate)) {
      parsedMl = {
        hb_estimate,
        hb_range: hb_range ?? [hb_estimate - 1.5, hb_estimate + 1.5],
        confidence: Number.isNaN(confidence) ? 0.8 : confidence,
        model_version: String(ml.model_version ?? result.model_version ?? "eyelid_hb_model_v1"),
      };
    }
  } else if (result.hb_estimate != null) {
    // Root level fallback
    const hb_estimate = Number(result.hb_estimate);
    const rawHbRange = result.hb_range;
    let hb_range: [number, number] | null = null;
    if (Array.isArray(rawHbRange) && rawHbRange.length >= 2) {
      const low = Number(rawHbRange[0]);
      const high = Number(rawHbRange[1]);
      if (!Number.isNaN(low) && !Number.isNaN(high)) {
        hb_range = [low, high];
      }
    }
    const confidence = Number(result.model_confidence ?? result.confidence ?? 0.8);
    parsedMl = {
      hb_estimate,
      hb_range: hb_range ?? [hb_estimate - 1.5, hb_estimate + 1.5],
      confidence: Number.isNaN(confidence) ? 0.8 : confidence,
      model_version: String(result.model_version ?? "eyelid_hb_model_v1"),
    };
  }

  const effectiveCc = cc ?? (result.risk_category ? (result as Record<string, Json>) : null);
  const effectiveNr = nr ?? (result.report ? (result.report as Record<string, Json>) : null);

  return {
    ml_prediction: parsedMl,
    clinical_classification: effectiveCc
      ? {
          risk_category: (effectiveCc.risk_category as ClinicalClassification["risk_category"]) ?? "normal",
          applicable_population: String(
            effectiveCc.applicable_population ??
              effectiveCc.applicable_reference_population ??
              effectiveCc.reference_population ??
              "Adult"
          ),
          threshold_version: String(effectiveCc.threshold_version ?? "who_2024_hb_v1"),
          reference_source: String(effectiveCc.reference_source ?? "WHO 2024 Guidelines"),
          thresholds_applied: (effectiveCc.thresholds_applied ?? null) as Record<string, number | string> | null,
          unclassifiable_reason: (effectiveCc.unclassifiable_reason ?? null) as string | null,
          disclaimer: String(effectiveCc.disclaimer ?? ""),
        }
      : null,
    narrative_report: effectiveNr
      ? {
          summary: String(effectiveNr.summary ?? ""),
          explanation: String(effectiveNr.explanation ?? effectiveNr.result_explanation ?? ""),
          risk_factors: (
            (effectiveNr.risk_factors as string[] | null) ??
            (effectiveNr.factors_considered as string[] | null) ??
            []
          ) as string[],
          recommendations: (
            (effectiveNr.recommendations as string[] | null) ??
            (effectiveNr.recommended_next_steps as string[] | null) ??
            []
          ) as string[],
          followup_urgency: String(effectiveNr.followup_urgency ?? ""),
          disclaimer: String(effectiveNr.disclaimer ?? ""),
        }
      : null,
  };
}
