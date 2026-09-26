"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingDown, TrendingUp, Minus, Building2, ExternalLink, Loader2 } from "lucide-react";
import { getUserScreeningHistory, type ScreeningHistoryItem } from "@/lib/supabase/screenings";

// Chart constants
const CHART_W = 300;
const CHART_H = 110;
const PAD_L = 22;
const PAD_R = 22;
const PAD_T = 36;
const PAD_B = 22;
const PLOT_W = CHART_W - PAD_L - PAD_R;
const PLOT_H = CHART_H - PAD_T - PAD_B;
const REF_HB = 12.0;

interface ChartPoint {
  x: number;
  y: number;
  hb: number;
  label: string;
  value: string;
  active: boolean;
}

function hbToY(hb: number, minHb: number, maxHb: number): number {
  const range = maxHb - minHb || 2;
  return PAD_T + PLOT_H - ((hb - minHb) / range) * PLOT_H;
}

function buildChartPoints(items: ScreeningHistoryItem[]): { points: ChartPoint[]; refY: number; minHb: number; maxHb: number } {
  const sorted = [...items]
    .filter((i) => i.hbEstimate !== null)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const hbValues = sorted.map((i) => i.hbEstimate as number);
  const rawMin = Math.min(...hbValues, REF_HB - 0.5);
  const rawMax = Math.max(...hbValues, REF_HB + 0.5);
  const padding = (rawMax - rawMin) * 0.15 || 1;
  const minHb = rawMin - padding;
  const maxHb = rawMax + padding;
  const refY = hbToY(REF_HB, minHb, maxHb);

  const points: ChartPoint[] = sorted.map((item, idx) => {
    const n = sorted.length;
    const x = n === 1 ? PAD_L + PLOT_W / 2 : PAD_L + (idx / (n - 1)) * PLOT_W;
    const hb = item.hbEstimate as number;
    const y = hbToY(hb, minHb, maxHb);
    return {
      x, y, hb,
      label: item.shortDate,
      value: `${hb.toFixed(1)} g/dL`,
      active: idx === n - 1,
    };
  });

  return { points, refY, minHb, maxHb };
}

interface TrendAndHealthcareProps {
  /** Optional: pass current report's Hb estimate so it shows in the trend immediately (before DB sync) */
  currentHbEstimate?: number | null;
  /** Optional: ISO date string of the current screening for labelling */
  screenedAt?: string | null;
  /** Optional: screening ID of current report (used to avoid duplicating the point from DB) */
  currentScreeningId?: string | null;
}

export default function TrendAndHealthcare({
  currentHbEstimate,
  screenedAt,
  currentScreeningId,
}: TrendAndHealthcareProps = {}) {
  const [historyItems, setHistoryItems] = useState<ScreeningHistoryItem[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getUserScreeningHistory().then(({ data }) => {
      if (mounted) {
        setHistoryItems(data);
        setTrendLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  // Merge current report's Hb into history if it isn't persisted yet
  const mergedItems: ScreeningHistoryItem[] = [...historyItems];
  const alreadyHasCurrent = currentScreeningId
    ? mergedItems.some((i) => i.id === currentScreeningId)
    : false;

  if (currentHbEstimate != null && !alreadyHasCurrent) {
    const fakeShortDate = screenedAt
      ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(screenedAt))
      : "Today";
    // Push a synthetic item for the current reading
    mergedItems.push({
      id: currentScreeningId ?? "__current__",
      screening: {} as ScreeningHistoryItem["screening"],
      report: null,
      parsed: { ml_prediction: null, clinical_classification: null, narrative_report: null },
      createdAt: screenedAt ?? new Date().toISOString(),
      formattedDate: fakeShortDate,
      shortDate: fakeShortDate,
      hbEstimate: currentHbEstimate,
      hbRange: "",
      riskLevel: "Pending",
      rawRiskCategory: null,
      summary: "",
      reportHref: "",
      isLatest: true,
    });
  }

  const itemsWithHb = mergedItems.filter((i) => i.hbEstimate !== null);
  const { points, refY } = itemsWithHb.length > 0
    ? buildChartPoints(itemsWithHb)
    : { points: [], refY: 0, minHb: 0, maxHb: 0 };

  // Slope calculation
  const sortedForSlope = [...itemsWithHb].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  let slopeText: string | null = null;
  let slopePositive = false;
  if (sortedForSlope.length >= 2) {
    const first = sortedForSlope[0];
    const last = sortedForSlope[sortedForSlope.length - 1];
    const monthsDiff =
      (new Date(last.createdAt).getTime() - new Date(first.createdAt).getTime()) /
      (1000 * 60 * 60 * 24 * 30.44);
    const hbDiff = (last.hbEstimate as number) - (first.hbEstimate as number);
    const slope = monthsDiff > 0.1 ? hbDiff / monthsDiff : hbDiff;
    slopePositive = slope >= 0;
    slopeText = `${slope >= 0 ? "+" : ""}${slope.toFixed(1)} g/dL/mo`;
  }

  return (
    <div className="space-y-4" id="trend-healthcare-column">
      {/* 1. Estimated Hb trend Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {slopePositive ? <TrendingUp className="w-4 h-4 text-emerald-600" /> : <TrendingDown className="w-4 h-4 text-accent-dark" />}
            <h2 className="text-sm sm:text-base font-bold text-heading">
              Estimated Hb trend
            </h2>
          </div>
          {slopeText ? (
            <span className="text-[11px] font-semibold text-muted bg-surface border border-border px-2.5 py-0.5 rounded-md">
              {slopeText} slope
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-muted bg-surface border border-border px-2.5 py-0.5 rounded-md">
              {itemsWithHb.length > 0 ? "Baseline" : "No data"}
            </span>
          )}
        </div>

        {/* Legend / Reference */}
        <div className="flex items-center justify-between text-xs font-semibold pt-1">
          <span className="text-muted">Reference Threshold ({REF_HB} g/dL)</span>
        </div>

        {/* Trend Graph Container */}
        <div className="p-4 rounded-xl bg-surface/50 border border-border/80">
          {trendLoading ? (
            <div className="flex items-center justify-center h-28 gap-2 text-muted">
              <Loader2 className="w-4 h-4 animate-spin text-accent-dark" />
              <span className="text-xs">Loading trend...</span>
            </div>
          ) : points.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-28 gap-2 text-center">
              <Minus className="w-4 h-4 text-muted" />
              <p className="text-xs text-muted max-w-[180px]">
                No historical data yet. Your first screening will appear here.
              </p>
            </div>
          ) : (
            <>
              <div className="relative w-full h-28">
                <svg
                  className="w-full h-full overflow-visible"
                  viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                  fill="none"
                  preserveAspectRatio="none"
                >
                  {/* Reference line */}
                  <line
                    x1={PAD_L}
                    y1={refY}
                    x2={CHART_W - PAD_R}
                    y2={refY}
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                  <text x={PAD_L + 4} y={refY - 4} fill="#94a3b8" fontSize="9" fontWeight="600">
                    {REF_HB} g/dL Baseline
                  </text>

                  {/* Trend line */}
                  {points.length >= 2 && (
                    <motion.path
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.9, ease: "easeOut" }}
                      d={`M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}`}
                      stroke="#0d9488"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Data points */}
                  {points.map((point) => (
                    <g key={point.label + point.hb}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={point.active ? "5" : "4"}
                        fill={point.active ? "#bf191d" : "#0d9488"}
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="shadow-xs"
                      />
                    </g>
                  ))}
                </svg>
              </div>

              {/* Bottom Labels */}
              <div
                className="grid text-center text-[10px] sm:text-[11px] pt-2 border-t border-border/60"
                style={{ gridTemplateColumns: `repeat(${points.length}, 1fr)` }}
              >
                {points.map((point) => (
                  <div key={point.label + point.hb} className="space-y-0.5">
                    <p className="text-muted">{point.label}</p>
                    <p className={`font-bold ${point.active ? "text-primary" : "text-heading"}`}>
                      {point.value}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* 2. Nearby healthcare options Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs space-y-3.5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-accent-dark" />
            <h2 className="text-sm sm:text-base font-bold text-heading">
              Nearby healthcare options
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-muted bg-surface border border-border px-2.5 py-0.5 rounded-md">
            Confirmed labs
          </span>
        </div>

        <p className="text-xs text-muted leading-relaxed">
          Walk-in phlebotomy services to confirm this screening with a standard CBC lab test:
        </p>

        {/* Clinics list */}
        <div className="space-y-2.5">
          {/* Clinic 1 */}
          <div className="p-3.5 rounded-xl bg-surface/70 border border-border space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold text-heading">
                CityCare Diagnostic Centre
              </h3>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-semibold text-accent-dark hover:underline"
              >
                <span>Contact clinic</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              1.8 km · Full venous blood panels available
            </p>
            <p className="text-[10px] font-semibold text-emerald-700">
              Open today until 18:00
            </p>
          </div>

          {/* Clinic 2 */}
          <div className="p-3.5 rounded-xl bg-surface/70 border border-border space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold text-heading">
                District Health Clinic
              </h3>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-semibold text-accent-dark hover:underline"
              >
                <span>Contact clinic</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              3.2 km · General outpatient &amp; pathology
            </p>
            <p className="text-[10px] font-semibold text-accent-dark">
              Walk-in triage accepted
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
