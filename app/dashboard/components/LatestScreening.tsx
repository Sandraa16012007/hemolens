"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, Loader2 } from "lucide-react";
import {
  getUserScreeningHistory,
  type ScreeningHistoryItem,
} from "@/lib/supabase/screenings";
import { useLanguage } from "@/app/context/LanguageContext";

function formatLocalTime(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat([], {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
}

function getHbDisplay(item: ScreeningHistoryItem): string {
  const range = item.parsed.ml_prediction?.hb_range;
  if (range && range.length >= 2) {
    const low = Number(range[0]);
    const high = Number(range[1]);
    if (!Number.isNaN(low) && !Number.isNaN(high)) {
      return `${low.toFixed(1)}–${high.toFixed(1)}`;
    }
  }
  return item.hbRange;
}

type ActiveRisk = "low" | "mild" | "moderate" | "high" | "none";

function getActiveRisk(riskLevel: ScreeningHistoryItem["riskLevel"]): ActiveRisk {
  switch (riskLevel) {
    case "Lower risk":
      return "low";
    case "Mild risk":
      return "mild";
    case "Moderate risk":
      return "moderate";
    case "High risk":
    case "Severe risk":
      return "high";
    default:
      return "none";
  }
}

function getBadgeClasses(riskLevel: ScreeningHistoryItem["riskLevel"]): {
  container: string;
  dot: string;
} {
  switch (riskLevel) {
    case "Lower risk":
      return {
        container:
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-bold",
        dot: "w-1.5 h-1.5 rounded-full bg-emerald-500",
      };
    case "Mild risk":
      return {
        container:
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200/80 text-amber-700 text-xs font-bold",
        dot: "w-1.5 h-1.5 rounded-full bg-amber-500",
      };
    case "Moderate risk":
      return {
        container:
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200/80 text-primary text-xs font-bold",
        dot: "w-1.5 h-1.5 rounded-full bg-primary animate-pulse",
      };
    case "High risk":
    case "Severe risk":
      return {
        container:
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 border border-red-200/80 text-red-700 text-xs font-bold",
        dot: "w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse",
      };
    default:
      return {
        container:
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-border text-muted text-xs font-bold",
        dot: "w-1.5 h-1.5 rounded-full bg-muted",
      };
  }
}

export default function LatestScreening() {
  const [item, setItem] = useState<ScreeningHistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const { data } = await getUserScreeningHistory();
        if (!mounted) return;
        setItem(data && data.length > 0 ? data[0] : null);
      } catch {
        if (!mounted) return;
        setItem(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const getLocalizedRiskLabel = (riskLevel: ScreeningHistoryItem["riskLevel"]) => {
    const s = String(riskLevel).toLowerCase();
    if (s.includes("low")) return t("dashboard.lowRisk", "Low Risk");
    if (s.includes("mild")) return t("dashboard.lowRisk", "Low Risk");
    if (s.includes("moderate")) return t("dashboard.moderate", "Moderate");
    if (s.includes("high") || s.includes("severe")) return t("dashboard.high", "High");
    return riskLevel;
  };

  return (
    <div className="space-y-3" id="latest-screening-section">
      {/* Section Title */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-bold text-heading">
          {t("dashboard.latestScreening", "Latest screening")}
        </h2>
      </div>

      {loading ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="rounded-2xl border border-border bg-white p-5"
          role="status"
          aria-busy="true"
          aria-label="Loading latest screening"
        >
          <div className="flex items-center justify-center gap-2 py-8 text-muted">
            <Loader2 className="w-5 h-5 animate-spin text-accent-dark" />
            <span className="text-sm font-medium">Loading latest screening…</span>
          </div>
        </motion.div>
      ) : !item ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="rounded-2xl border border-border bg-white p-5 transition-all"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2 flex-1">
              <p className="text-sm sm:text-base font-semibold text-heading">
                {t("history.noRecords", "No screening records found.")}
              </p>
              <p className="text-xs sm:text-sm text-muted">
                {t("dashboard.noScreenings", "No screening history yet. Start your first non-invasive screening today.")}
              </p>
            </div>
            <div className="shrink-0 flex items-center">
              <Link
                href="/new-screening"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-surface border border-border text-xs sm:text-sm font-semibold text-heading hover:bg-accent/20 hover:text-accent-dark hover:border-accent/40 active:scale-[0.98] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
              >
                <span>{t("dashboard.startNewScreening", "Start New Screening")}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </motion.div>
      ) : (
        (() => {
          const activeRisk = getActiveRisk(item.riskLevel);
          const activeIndex =
            activeRisk === "low" ? 0 : activeRisk === "none" ? -1 : activeRisk === "high" ? 2 : 1;
          const badge = getBadgeClasses(item.riskLevel);
          const hbDisplay = getHbDisplay(item);
          const localTime = formatLocalTime(item.createdAt);
          const reportHref = item.reportHref || "/screening-report";

          const seg0 = activeIndex === 0
            ? activeRisk === "mild"
              ? "bg-amber-400"
              : "bg-emerald-500"
            : "bg-emerald-100";
          const seg1 =
            activeIndex === 1
              ? activeRisk === "mild"
                ? "bg-amber-400 shadow-xs"
                : "bg-primary shadow-xs"
              : activeRisk === "none"
                ? "bg-surface"
                : "bg-rose-100/60";
          const seg2 = activeIndex === 2 ? "bg-red-500 shadow-xs" : "bg-rose-100";
          const dotColor =
            activeRisk === "low"
              ? "bg-emerald-500 border-white ring-emerald-500/40"
              : activeRisk === "mild"
                ? "bg-amber-400 border-white ring-amber-400/40"
                : activeRisk === "moderate"
                  ? "bg-primary border-white ring-primary/40"
                  : activeRisk === "high"
                    ? "bg-red-500 border-white ring-red-500/40"
                    : "bg-muted border-white ring-muted/40";

          return (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.15 }}
              whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}
              className="rounded-2xl border border-border bg-white p-5 transition-all"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                {/* Metric & Timestamp details */}
                <div className="space-y-4 flex-1">
                  {/* Timestamp */}
                  <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted uppercase">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{t("dashboard.lastScreening", "LAST SCREENING")}</span>
                    <span className="text-heading font-medium">{item.formattedDate}</span>
                    {localTime ? (
                      <>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <span className="normal-case font-normal text-muted">
                          {localTime}
                        </span>
                      </>
                    ) : null}
                  </div>

                  {/* Estimated Hb & Badge */}
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="text-xs sm:text-sm font-medium text-muted">
                      {t("dashboard.estimatedHbPrefix", "Estimated Hb:")}
                    </span>
                    <span className="text-2xl sm:text-3xl font-extrabold text-heading tracking-tight">
                      {hbDisplay}
                    </span>
                    <span className="text-xs font-medium text-muted">g/dL</span>

                    <span className={badge.container}>
                      <span className={badge.dot} />
                      {getLocalizedRiskLabel(item.riskLevel)}
                    </span>
                  </div>

                  {/* Visual Risk Gradient Progress Bar */}
                  <div className="space-y-1.5 pt-1 max-w-xl">
                    {/* Range labels */}
                    <div className="flex justify-between text-[11px] font-medium text-muted">
                      <span className={activeIndex === 0 ? "text-emerald-700 font-bold" : "text-muted/80"}>
                        {t("dashboard.lowRisk", "Low Risk")} (&gt;12.0)
                      </span>
                      <span
                        className={
                          activeIndex === 1
                            ? activeRisk === "mild"
                              ? "text-amber-700 font-bold"
                              : "text-primary font-bold"
                            : "text-muted/80"
                        }
                      >
                        {t("dashboard.moderate", "Moderate")} (10.0–11.9)
                      </span>
                      <span className={activeIndex === 2 ? "text-red-700 font-bold" : "text-muted/80"}>
                        {t("dashboard.high", "High")} (&lt;10.0)
                      </span>
                    </div>

                    {/* Visual Multi-segment bar */}
                    <div className="h-2 w-full rounded-full bg-surface border border-border/80 flex overflow-hidden p-0.5">
                      {/* Low risk range */}
                      <div className={`w-1/3 ${seg0} rounded-l-full relative`}>
                        {activeIndex === 0 ? (
                          <span
                            className={`absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border-2 ring-1 ${dotColor}`}
                          />
                        ) : null}
                      </div>
                      {/* Moderate risk range */}
                      <div className={`w-1/3 ${seg1} rounded-xs relative`}>
                        {activeIndex === 1 ? (
                          <span
                            className={`absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border-2 ring-1 ${dotColor}`}
                          />
                        ) : null}
                      </div>
                      {/* High risk range */}
                      <div className={`w-1/3 ${seg2} rounded-r-full relative`}>
                        {activeIndex === 2 ? (
                          <span
                            className={`absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full border-2 ring-1 ${dotColor}`}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: View Report CTA */}
                <div className="shrink-0 flex items-center">
                  <Link
                    href={reportHref}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-surface border border-border text-xs sm:text-sm font-semibold text-heading hover:bg-accent/20 hover:text-accent-dark hover:border-accent/40 active:scale-[0.98] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                    id="btn-view-report-latest"
                  >
                    <span>{t("dashboard.viewReport", "View Report")}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </motion.div>
          );
        })()
      )}
    </div>
  );
}
