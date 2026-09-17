"use client";

import { motion } from "framer-motion";
import { Droplet, AlertTriangle, HelpCircle } from "lucide-react";

export default function TopMetricsGrid() {
  return (
    <div className="space-y-4" id="top-metrics-grid">
      {/* 2-Card Row: Estimated Hb & Anemia Risk */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {/* Card 1: Estimated Hb Range */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold tracking-wider uppercase text-muted">
                Estimated Hb Range
              </span>
              <div className="w-7 h-7 rounded-lg bg-accent/30 text-accent-dark flex items-center justify-center">
                <Droplet className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Hb Value */}
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-3xl sm:text-4xl font-extrabold text-heading tracking-tight">
                10.2–11.0
              </span>
              <span className="text-sm font-semibold text-muted">g/dL</span>
            </div>

            <p className="text-xs text-muted leading-relaxed mb-4">
              Estimated from palpebral conjunctiva optical density analysis.
            </p>
          </div>

          {/* Baseline Comparisons */}
          <div className="pt-3 border-t border-border/70 space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-muted">
              <span>Patient reading</span>
              <span className="font-semibold text-heading">
                10.6 g/dL <span className="font-normal text-muted">(midpoint)</span>
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted">Typical adult baseline: 12.0–15.5 g/dL</span>
              <span className="text-primary font-bold">
                -1.4 g/dL variance
              </span>
            </div>
          </div>
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

            {/* Risk Badge */}
            <div className="mb-2">
              <span className="inline-block px-3.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-primary font-black text-sm sm:text-base tracking-wider">
                MODERATE
              </span>
            </div>

            <p className="text-xs text-muted leading-relaxed mb-4">
              This result suggests a moderate probability of low hemoglobin levels.
            </p>
          </div>

          {/* 3-Stage Risk Segmented Pill Bar */}
          <div className="pt-3 border-t border-border/70">
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-surface border border-border text-center text-xs font-semibold">
              <div className="py-1.5 rounded-lg text-muted">
                Low
              </div>
              <div className="py-1.5 rounded-lg bg-white text-primary border border-rose-200 shadow-xs font-bold">
                Moderate
              </div>
              <div className="py-1.5 rounded-lg text-muted">
                High
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Card 3: Result Confidence Banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.12 }}
        className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-bold text-heading">
              Result confidence
            </span>
            <span title="Model confidence estimation" className="inline-flex cursor-pointer">
              <HelpCircle className="w-3.5 h-3.5 text-muted" />
            </span>
          </div>
          <span className="text-base sm:text-lg font-extrabold text-accent-dark">
            82%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-2 w-full rounded-full bg-surface border border-border overflow-hidden p-0.5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "82%" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-full rounded-full bg-accent-dark"
          />
        </div>

        <p className="text-xs text-muted leading-relaxed">
          Confidence indicates how strongly the screening model supports this result based on palpebral vascularity and illumination indices. It does not indicate definitive medical certainty.
        </p>
      </motion.div>
    </div>
  );
}
