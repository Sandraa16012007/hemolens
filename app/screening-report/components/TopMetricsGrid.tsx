"use client";

import { motion } from "framer-motion";
import {
  Droplet,
  AlertTriangle,
} from "lucide-react";
import type { MLPrediction, ClinicalClassification } from "@/lib/supabase/reportResult";

interface TopMetricsGridProps {
  reportStatus?: string;
  /** Live ML prediction from backend (null = still pending) */
  mlPrediction?: MLPrediction | null;
  /** WHO 2024 deterministic classification (null = still pending) */
  clinicalClassification?: ClinicalClassification | null;
}

// ─── Risk colour tokens ─────────────────────────────────────────────────────
const RISK_STYLES: Record<
  string,
  { badge: string; highlight: string }
> = {
  normal: {
    badge: "bg-emerald-50 border-emerald-200 text-emerald-800",
    highlight: "bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-xs font-bold",
  },
  mild: {
    badge: "bg-amber-50 border-amber-200 text-amber-800",
    highlight: "bg-amber-50 text-amber-800 border border-amber-200 shadow-xs font-bold",
  },
  moderate: {
    badge: "bg-rose-50 border-rose-200 text-primary",
    highlight: "bg-white text-primary border border-rose-200 shadow-xs font-bold",
  },
  severe: {
    badge: "bg-red-100 border-red-300 text-red-900",
    highlight: "bg-red-100 text-red-900 border border-red-300 shadow-xs font-bold",
  },
  unclassifiable: {
    badge: "bg-surface border-border text-muted",
    highlight: "bg-surface text-muted border border-border shadow-xs font-bold",
  },
};

export default function TopMetricsGrid({
  reportStatus = "pending",
  mlPrediction,
  clinicalClassification,
}: TopMetricsGridProps) {
  const isPending = reportStatus === "pending" || reportStatus === "processing";
  const riskCategory = clinicalClassification?.risk_category ?? "unclassifiable";
  const riskStyle = RISK_STYLES[riskCategory] ?? RISK_STYLES.unclassifiable;

  // ─── Next Action Guidance by Risk Tier ───────────────────────────────────────
  const NEXT_STEPS_BY_RISK: Record<string, string> = {
    normal: "Next Step: Maintain an iron-rich diet and continue routine wellness monitoring.",
    mild: "Next Step: Schedule a physician consultation and get a confirmatory CBC lab test.",
    moderate: "Next Step: Consult a doctor promptly for a confirmatory CBC test and clinical evaluation.",
    severe: "Next Step: Seek urgent medical attention and confirmatory diagnostic testing.",
    unclassifiable: "Next Step: Complete your health profile and consult a doctor for a CBC test.",
  };

  const nextStepLine = NEXT_STEPS_BY_RISK[riskCategory] ?? NEXT_STEPS_BY_RISK.unclassifiable;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5" id="top-metrics-grid">
      {/* Card 1: Estimated Hemoglobin Level */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold tracking-wider uppercase text-muted">
              Estimated Hb Level
            </span>
            <div className="w-7 h-7 rounded-lg bg-accent/30 text-accent-dark flex items-center justify-center">
              <Droplet className="w-3.5 h-3.5" />
            </div>
          </div>

          {isPending || !mlPrediction || typeof mlPrediction.hb_estimate !== "number" || Number.isNaN(mlPrediction.hb_estimate) ? (
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-2xl font-extrabold text-muted tracking-tight">
                {isPending ? "Awaiting analysis" : "—"}
              </span>
            </div>
          ) : (
            <div className="mb-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-extrabold text-heading tracking-tight">
                  {mlPrediction.hb_estimate.toFixed(1)}
                </span>
                <span className="text-sm font-semibold text-muted">g/dL</span>
              </div>
              {Array.isArray(mlPrediction.hb_range) && mlPrediction.hb_range.length >= 2 && (
                <div className="text-xs font-semibold text-accent-dark mt-0.5">
                  Estimated Range: {(mlPrediction.hb_range[0] ?? 0).toFixed(1)}–{(mlPrediction.hb_range[1] ?? 0).toFixed(1)} g/dL
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-muted leading-relaxed mb-4">
            {isPending
              ? "Your images have been uploaded and are queued for AI analysis."
              : "Estimated from palpebral conjunctiva optical density analysis."}
          </p>
        </div>

        {!isPending && mlPrediction && (
          <div className="pt-3 border-t border-border/70 space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-muted">
              <span>Patient reading</span>
              <span className="font-semibold text-heading">
                {typeof mlPrediction.hb_estimate === "number" ? mlPrediction.hb_estimate.toFixed(1) : "—"} g/dL
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">
                Reference: {clinicalClassification?.applicable_population ?? "Adult"}
              </span>
              <span className="text-primary font-bold">
                {riskCategory.toUpperCase()}
              </span>
            </div>
          </div>
        )}
      </motion.div>

      {/* Card 2: Anemia Risk Level */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold tracking-wider uppercase text-muted">
              Anemia Risk
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-primary flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="mb-2">
            {isPending || !clinicalClassification ? (
              <span className="inline-block px-3.5 py-1 rounded-lg bg-surface border border-border text-muted font-bold text-sm tracking-wider">
                {isPending ? "PENDING" : "—"}
              </span>
            ) : (
              <span
                className={`inline-block px-3.5 py-1 rounded-lg font-black text-sm sm:text-base tracking-wider border ${riskStyle.badge}`}
              >
                {riskCategory.toUpperCase()}
              </span>
            )}
          </div>

          <p className="text-xs text-muted leading-relaxed mb-2">
            {isPending
              ? "Risk classification will be available after AI analysis completes."
              : clinicalClassification
              ? `WHO 2024 — ${clinicalClassification.applicable_population}.`
              : "This result suggests a risk of low hemoglobin levels."}
          </p>

          {!isPending && (
            <p className="text-xs font-semibold text-heading leading-snug mb-3.5">
              {nextStepLine}
            </p>
          )}
        </div>

        <div className="pt-3 border-t border-border/70">
          {/* Risk level indicator bar */}
          <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-surface border border-border text-center text-xs font-semibold">
            {(["normal", "mild", "moderate", "severe"] as const).map((level) => {
              const isActive = !isPending && clinicalClassification?.risk_category === level;
              return (
                <div
                  key={level}
                  className={`py-1.5 rounded-lg capitalize ${
                    isActive ? riskStyle.highlight : "text-muted"
                  }`}
                >
                  {level}
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
