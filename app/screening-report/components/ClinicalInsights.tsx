"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ClipboardCheck,
  Moon,
  RefreshCw,
  Apple,
  Camera,
  User,
  ListChecks,
  Check,
  AlertCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import type { NarrativeReport } from "@/lib/supabase/reportResult";
import { useLanguage } from "@/app/context/LanguageContext";
import { translateReportText } from "@/lib/utils/translateReport";

interface ClinicalInsightsProps {
  narrativeReport?: NarrativeReport | null;
}

const STATIC_FACTORS = [
  { label: "Fatigue", icon: Moon },
  { label: "Dizziness", icon: RefreshCw },
  { label: "Diet (Plant-forward)", icon: Apple },
  { label: "Image analysis (Lower eyelid)", icon: Camera },
  { label: "Health profile", icon: User },
];

const DEFAULT_RECOMMENDATIONS = [
  "Consider discussing this result with a healthcare professional or primary care physician.",
  "A laboratory blood test (Complete Blood Count / CBC) is required to confirm whether you have anemia.",
];

const DEFAULT_DISCLAIMER =
  "Do not use this preliminary screening result as a medical diagnosis or alter medications autonomously.";

export default function ClinicalInsights({ narrativeReport }: ClinicalInsightsProps) {
  const { language, t } = useLanguage();

  const recommendations =
    narrativeReport?.recommendations?.length
      ? narrativeReport.recommendations
      : DEFAULT_RECOMMENDATIONS;

  const disclaimer = narrativeReport?.disclaimer ?? DEFAULT_DISCLAIMER;

  return (
    <div className="space-y-4" id="clinical-insights-column">
      {/* 0. AI-generated summary (shown only when available) */}
      {narrativeReport?.summary && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="rounded-2xl border border-accent/30 bg-accent/5 p-5 sm:p-6 shadow-xs"
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-accent-dark" />
            <span className="text-xs font-bold tracking-wider uppercase text-accent-dark">
              {t("report.summary", "AI Summary")}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-heading leading-relaxed">
            {translateReportText(narrativeReport.summary, language)}
          </p>
        </motion.div>
      )}



      {/* 2. Factors considered */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.18 }}
        className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs"
      >
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-accent-dark" />
            <h2 className="text-sm sm:text-base font-bold text-heading">
              {t("report.factorsConsidered", "Factors considered")}
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-muted bg-surface border border-border px-2.5 py-0.5 rounded-md">
            {narrativeReport?.risk_factors?.length
              ? `${narrativeReport.risk_factors.length} input signals verified`
              : "5 input signals verified"}
          </span>
        </div>

        {/* Badges — Dynamic AI factors or Static fallbacks */}
        <div className="flex flex-wrap gap-2">
          {narrativeReport?.risk_factors && narrativeReport.risk_factors.length > 0 ? (
            narrativeReport.risk_factors.map((factor, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs font-medium text-heading"
              >
                <Sparkles className="w-3.5 h-3.5 text-accent-dark" />
                <span>{translateReportText(factor, language)}</span>
              </div>
            ))
          ) : (
            STATIC_FACTORS.map((factor) => {
              const Icon = factor.icon;
              return (
                <div
                  key={factor.label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs font-medium text-heading"
                >
                  <Icon className="w-3.5 h-3.5 text-accent-dark" />
                  <span>{translateReportText(factor.label, language)}</span>
                </div>
              );
            })
          )}
        </div>
      </motion.div>

      {/* 3. What should I do next? */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.22 }}
        className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs space-y-4"
      >
        <div className="flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-accent-dark" />
          <h2 className="text-sm sm:text-base font-bold text-heading">
            {t("report.recommendations", "What should I do next?")}
          </h2>
        </div>

        {/* Guidance Items — AI-driven recommendations with static fallback */}
        <div className="space-y-2.5">
          {recommendations.map((rec, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-xl bg-surface/70 border border-border"
            >
              <div className="w-4 h-4 rounded-full bg-accent-dark/15 text-accent-dark flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3 h-3 stroke-[2.5]" />
              </div>
              <p className="text-xs text-heading leading-relaxed">{translateReportText(rec, language)}</p>
            </div>
          ))}

          {/* Always show the medical disclaimer alert */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-50/60 border border-rose-200/80">
            <div className="w-4 h-4 rounded-full bg-rose-100 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle className="w-3 h-3 stroke-[2.5]" />
            </div>
            <p className="text-xs text-rose-950 leading-relaxed">{translateReportText(disclaimer, language)}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
          <Link
            href="/ai-assistant"
            className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent-dark text-white text-xs sm:text-sm font-semibold hover:bg-accent-dark/90 active:scale-[0.98] transition-all shadow-xs cursor-pointer"
            id="btn-ask-hemoai"
          >
            <span>Ask HemoAI</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <button
            type="button"
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-surface border border-border text-xs sm:text-sm font-semibold text-heading hover:bg-surface/80 active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>View Recommendations</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
