"use client";

import { motion } from "framer-motion";
import { TrendingDown, Building2, ExternalLink } from "lucide-react";

export default function TrendAndHealthcare() {
  const trendData = [
    { date: "15 Jul 2026", value: "11.4 g/dL", x: 40, y: 55, active: false },
    { date: "22 Aug 2026", value: "10.8 g/dL", x: 150, y: 75, active: false },
    { date: "17 Sep (Today)", value: "10.5 g/dL", x: 260, y: 88, active: true },
  ];

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
            <TrendingDown className="w-4 h-4 text-accent-dark" />
            <h2 className="text-sm sm:text-base font-bold text-heading">
              Estimated Hb trend
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-muted bg-surface border border-border px-2.5 py-0.5 rounded-md">
            Past 3 months
          </span>
        </div>

        {/* Legend / Metrics */}
        <div className="flex items-center justify-between text-xs font-semibold pt-1">
          <span className="text-muted">Reference Threshold (12.0 g/dL)</span>
          <span className="text-accent-dark font-bold">-0.9 g/dL slope</span>
        </div>

        {/* Trend Graph Container */}
        <div className="p-4 rounded-xl bg-surface/50 border border-border/80">
          <div className="relative w-full h-28">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 300 110"
              fill="none"
              preserveAspectRatio="none"
            >
              {/* Reference line (12.0 g/dL) */}
              <line
                x1="20"
                y1="35"
                x2="280"
                y2="35"
                stroke="#cbd5e1"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <text x="25" y="30" fill="#94a3b8" fontSize="9" fontWeight="600">
                12.0 g/dL Target Baseline
              </text>

              {/* Trend Polyline */}
              <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                d="M 40 55 L 150 75 L 260 88"
                stroke="#0d9488"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data points */}
              {trendData.map((point) => (
                <g key={point.date}>
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
          <div className="grid grid-cols-3 text-center text-[10px] sm:text-[11px] pt-2 border-t border-border/60">
            {trendData.map((point) => (
              <div key={point.date} className="space-y-0.5">
                <p className="text-muted">{point.date}</p>
                <p
                  className={`font-bold ${
                    point.active ? "text-primary" : "text-heading"
                  }`}
                >
                  {point.value}
                </p>
              </div>
            ))}
          </div>
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
              3.2 km · General outpatient & pathology
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
