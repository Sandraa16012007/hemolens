"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Phone, Check, Loader2 } from "lucide-react";
import { getUserScreeningHistory, type ScreeningHistoryItem } from "@/lib/supabase/screenings";

// Chart constants
const CHART_W = 340;
const CHART_H = 160;
const PAD_L = 38;
const PAD_R = 20;
const PAD_T = 22;
const PAD_B = 20;
const PLOT_W = CHART_W - PAD_L - PAD_R;
const PLOT_H = CHART_H - PAD_T - PAD_B;
const REF_HB = 12.0; // reference baseline g/dL

interface ChartPoint {
  x: number;
  y: number;
  hb: number;
  label: string;
  isLatest: boolean;
}

function hbToY(hb: number, minHb: number, maxHb: number): number {
  // Map hb value to SVG y coordinate (higher hb = lower y number = higher on chart)
  const range = maxHb - minHb || 2;
  return PAD_T + PLOT_H - ((hb - minHb) / range) * PLOT_H;
}

function buildChartPoints(items: ScreeningHistoryItem[]): ChartPoint[] {
  // Items sorted ascending for chart (earliest → latest)
  const sorted = [...items]
    .filter((i) => i.hbEstimate !== null)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (sorted.length === 0) return [];

  const hbValues = sorted.map((i) => i.hbEstimate as number);
  const rawMin = Math.min(...hbValues, REF_HB - 0.5);
  const rawMax = Math.max(...hbValues, REF_HB + 0.5);
  const padding = (rawMax - rawMin) * 0.15 || 1;
  const minHb = rawMin - padding;
  const maxHb = rawMax + padding;

  return sorted.map((item, idx) => {
    const n = sorted.length;
    const x = n === 1 ? PAD_L + PLOT_W / 2 : PAD_L + (idx / (n - 1)) * PLOT_W;
    const hb = item.hbEstimate as number;
    const y = hbToY(hb, minHb, maxHb);
    return { x, y, hb, label: item.shortDate, isLatest: idx === n - 1 };
  });
}


export default function TrendAndClinicalHelp() {
  const [contactedLab, setContactedLab] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<ScreeningHistoryItem[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);

  const labs = [
    {
      id: "lab-1",
      name: "CityCare Diagnostic Centre",
      phone: "+1 (800) 555-0199",
      address: "Downtown Medical Plaza, Suite 300",
    },
    {
      id: "lab-2",
      name: "District Health Phlebotomy Lab",
      phone: "+1 (800) 555-0142",
      address: "Community Health Center, 2nd Floor",
    },
  ];

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

  const chartPoints = buildChartPoints(historyItems);
  const itemsWithHb = historyItems.filter((i) => i.hbEstimate !== null);
  const sorted = [...itemsWithHb].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Slope: change in Hb per month
  let slopeText: string | null = null;
  let slopePositive = false;
  if (sorted.length >= 2) {
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const monthsDiff =
      (new Date(last.createdAt).getTime() - new Date(first.createdAt).getTime()) /
      (1000 * 60 * 60 * 24 * 30.44);
    const hbDiff = (last.hbEstimate as number) - (first.hbEstimate as number);
    const slope = monthsDiff > 0.1 ? hbDiff / monthsDiff : hbDiff;
    slopePositive = slope >= 0;
    slopeText = `${slope >= 0 ? "+" : ""}${slope.toFixed(1)} g/dL/mo`;
  }

  const handleContact = (labName: string) => {
    setContactedLab(labName);
    setTimeout(() => {
      setContactedLab(null);
    }, 3500);
  };

  return (
    <div className="space-y-5">
      {/* 1. Estimated Hb Trend Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="rounded-2xl border border-border bg-white p-5 sm:p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-bold text-heading">
            Estimated Hb Trend
          </h2>
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            {slopePositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4 text-primary" />}
          </div>
        </div>

        {/* Chart Container */}
        <div className="bg-[#f8fafc]/80 rounded-xl p-4 border border-border/60 mb-4">
          {trendLoading ? (
            <div className="flex items-center justify-center h-44 gap-2 text-muted">
              <Loader2 className="w-5 h-5 animate-spin text-accent-dark" />
              <span className="text-xs">Loading trend...</span>
            </div>
          ) : chartPoints.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-44 gap-2 text-center">
              <Minus className="w-5 h-5 text-muted" />
              <p className="text-xs text-muted max-w-[200px]">
                No historical screenings recorded yet. Complete a screening to begin tracking your Hb trend.
              </p>
            </div>
          ) : (
            <div className="relative w-full h-44">
              <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                className="w-full h-full overflow-visible"
                aria-label="Hemoglobin level trend over past screenings"
              >
                <defs>
                  <linearGradient id="historyAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#088395" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#088395" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Reference baseline */}
                {(() => {
                  const hbValues = chartPoints.map((p) => p.hb);
                  const rawMin = Math.min(...hbValues, REF_HB - 0.5);
                  const rawMax = Math.max(...hbValues, REF_HB + 0.5);
                  const padding = (rawMax - rawMin) * 0.15 || 1;
                  const minHb = rawMin - padding;
                  const maxHb = rawMax + padding;
                  const refY = hbToY(REF_HB, minHb, maxHb);
                  return (
                    <>
                      <line x1={PAD_L} y1={refY} x2={CHART_W - PAD_R} y2={refY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />
                      <text x={PAD_L + 2} y={refY - 4} fill="#64748b" fontSize="8" fontFamily="sans-serif">Reference {REF_HB} g/dL</text>
                    </>
                  );
                })()}

                {/* Area fill */}
                {chartPoints.length >= 2 && (
                  <polygon
                    points={[
                      ...chartPoints.map((p) => `${p.x},${p.y}`),
                      `${chartPoints[chartPoints.length - 1].x},${CHART_H - PAD_B + 8}`,
                      `${chartPoints[0].x},${CHART_H - PAD_B + 8}`,
                    ].join(" ")}
                    fill="url(#historyAreaGrad)"
                  />
                )}

                {/* Trend line */}
                {chartPoints.length >= 2 && (
                  <polyline
                    points={chartPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke="#088395"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Data points */}
                {chartPoints.map((point) => (
                  <g key={point.label + point.hb}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={point.isLatest ? 5 : 4.5}
                      fill={point.isLatest ? "#bf191d" : "#ffffff"}
                      stroke={point.isLatest ? "#ffffff" : "#088395"}
                      strokeWidth="2.5"
                    />
                    <text x={point.x} y={point.y - 9} textAnchor="middle" fill={point.isLatest ? "#bf191d" : "#0f172a"} fontSize="9" fontWeight="700" fontFamily="sans-serif">
                      {point.hb.toFixed(1)}
                    </text>
                    <text x={point.x} y={CHART_H - PAD_B + 14} textAnchor="middle" fill={point.isLatest ? "#0f172a" : "#64748b"} fontSize="9" fontWeight={point.isLatest ? "600" : "400"} fontFamily="sans-serif">
                      {point.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          )}
        </div>

        {/* Slope / note callout */}
        {!trendLoading && chartPoints.length >= 2 && slopeText && (
          <div className="rounded-xl bg-[#f8fafc] border border-border/80 p-3.5 flex items-start gap-2.5">
            <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${slopePositive ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-primary"}`}>
              {slopePositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            </div>
            <p className="text-xs text-muted leading-relaxed">
              <strong className="text-heading font-semibold">Trend:</strong>{" "}
              {slopePositive
                ? `Your Hb estimate is trending upward (${slopeText}). Keep up your dietary habits.`
                : `Your latest estimate is lower than your first screening (${slopeText}). A routine blood test can confirm your iron levels.`}
            </p>
          </div>
        )}
        {!trendLoading && chartPoints.length === 1 && (
          <div className="rounded-xl bg-[#f8fafc] border border-border/80 p-3.5 flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs text-muted leading-relaxed">
              <strong className="text-heading font-semibold">Baseline recorded.</strong>{" "}
              Complete more screenings over time to see how your Hb estimate trends.
            </p>
          </div>
        )}
      </motion.div>

      {/* 2. Need Clinical Help? Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className="rounded-2xl border border-border bg-white p-5 sm:p-6"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <h2 className="text-base sm:text-lg font-bold text-heading">
            Need Clinical Help?
          </h2>
        </div>
        <p className="text-xs text-muted leading-relaxed mb-4">
          Quickly share this trend record with certified local medical
          laboratories or request formal phlebotomy services.
        </p>

        {/* Toast Alert when contacted */}
        <AnimatePresence>
          {contactedLab && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2"
            >
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>
                Contact request dispatched to <strong>{contactedLab}</strong>. A clinic coordinator will call you.
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Labs List */}
        <div className="space-y-2.5">
          {labs.map((lab) => (
            <div
              key={lab.id}
              className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface/80 border border-border/80 hover:border-accent/40 transition-all"
            >
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-semibold text-heading truncate">
                  {lab.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => handleContact(lab.name)}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-surface-alt border border-border text-xs font-semibold text-heading transition-colors shadow-2xs hover:border-border/90 active:scale-95"
              >
                <Phone className="w-3 h-3 text-muted" />
                <span>Contact</span>
              </button>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
