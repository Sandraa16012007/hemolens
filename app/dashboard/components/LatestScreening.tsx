"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Calendar } from "lucide-react";

export default function LatestScreening() {
  return (
    <div className="space-y-3" id="latest-screening-section">
      {/* Section Title */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-bold text-heading">
          Latest screening
        </h2>
      </div>

      {/* Active Screening Result Card */}
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
              <span>Last Screening</span>
              <span className="text-heading font-medium">17 Sep 2026</span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span className="normal-case font-normal text-muted">
                14:32 Local Time
              </span>
            </div>

            {/* Estimated Hb & Badge */}
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-xs sm:text-sm font-medium text-muted">
                Estimated Hb:
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold text-heading tracking-tight">
                10.2–11.0
              </span>
              <span className="text-xs font-medium text-muted">g/dL</span>

              {/* Moderate Risk Badge */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200/80 text-primary text-xs font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Moderate risk
              </span>
            </div>

            {/* Visual Risk Gradient Progress Bar */}
            <div className="space-y-1.5 pt-1 max-w-xl">
              {/* Range labels */}
              <div className="flex justify-between text-[11px] font-medium text-muted">
                <span className="text-muted/80">Low Risk (&gt;12.0)</span>
                <span className="text-primary font-bold">
                  Moderate (10.0–11.9)
                </span>
                <span className="text-muted/80">High (&lt;10.0)</span>
              </div>

              {/* Visual Multi-segment bar */}
              <div className="h-2 w-full rounded-full bg-surface border border-border/80 flex overflow-hidden p-0.5">
                {/* Low risk range */}
                <div className="w-1/3 bg-emerald-100 rounded-l-full" />
                {/* Moderate risk range (active) */}
                <div className="w-1/3 bg-primary rounded-xs relative shadow-xs">
                  {/* Indicator Dot */}
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-primary border-2 border-white ring-1 ring-primary/40" />
                </div>
                {/* High risk range */}
                <div className="w-1/3 bg-rose-100 rounded-r-full" />
              </div>
            </div>
          </div>

          {/* Right: View Report CTA */}
          <div className="shrink-0 flex items-center">
            <Link
              href="/screening-report"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-surface border border-border text-xs sm:text-sm font-semibold text-heading hover:bg-accent/20 hover:text-accent-dark hover:border-accent/40 active:scale-[0.98] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
              id="btn-view-report-latest"
            >
              <span>View Report</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
