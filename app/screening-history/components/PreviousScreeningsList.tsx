"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpDown, ArrowRight } from "lucide-react";

interface ScreeningRecord {
  id: string;
  date: string;
  isLatest?: boolean;
  riskLevel: "Moderate risk" | "Lower risk" | "High risk";
  hbRange: string;
  summary: string;
  reportHref: string;
}

const mockScreenings: ScreeningRecord[] = [
  {
    id: "scr-1",
    date: "17 Sep 2026",
    isLatest: true,
    riskLevel: "Moderate risk",
    hbRange: "10.2–11.0",
    summary:
      "Suggests moderate anemia risk. A blood test is recommended to confirm your iron levels.",
    reportHref: "/screening-report",
  },
  {
    id: "scr-2",
    date: "12 Aug 2026",
    isLatest: false,
    riskLevel: "Lower risk",
    hbRange: "11.5–12.2",
    summary: "Suggests low anemia risk with healthy estimated levels.",
    reportHref: "/screening-report",
  },
  {
    id: "scr-3",
    date: "20 Jun 2026",
    isLatest: false,
    riskLevel: "Lower risk",
    hbRange: "11.0–11.8",
    summary: "Initial screening showed normal estimated levels.",
    reportHref: "/screening-report",
  },
];

export default function PreviousScreeningsList() {
  const [sortOrder, setSortOrder] = useState<"recent" | "oldest">("recent");

  const screenings = [...mockScreenings].sort((a, b) => {
    if (sortOrder === "recent") {
      return a.isLatest ? -1 : 1;
    } else {
      return a.isLatest ? 1 : -1;
    }
  });

  return (
    <div className="space-y-4">
      {/* Header bar: Count & Sort */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-bold text-heading">
            Previous Screenings
          </h2>
          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-accent/40 text-accent-dark border border-accent/60">
            {screenings.length}
          </span>
        </div>

        {/* Sort toggle */}
        <button
          type="button"
          onClick={() =>
            setSortOrder((prev) => (prev === "recent" ? "oldest" : "recent"))
          }
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-heading font-medium transition-colors px-2.5 py-1.5 rounded-lg hover:bg-surface border border-transparent hover:border-border"
          aria-label="Sort order toggle"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-muted" />
          <span>{sortOrder === "recent" ? "Most recent first" : "Oldest first"}</span>
        </button>
      </div>

      {/* Screenings List */}
      <div className="space-y-3.5">
        {screenings.map((screening, idx) => (
          <motion.div
            key={screening.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.06 }}
            whileHover={{ y: -2, boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}
            className={`rounded-2xl border bg-white p-5 sm:p-6 transition-all relative overflow-hidden ${
              screening.isLatest
                ? "border-border border-l-4 border-l-primary"
                : "border-border"
            }`}
          >
            {/* Top row: Date + Badges */}
            <div className="flex items-center justify-between gap-3 mb-2.5 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-bold text-heading">
                  {screening.date}
                </span>
                {screening.isLatest && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#e0f7f8] text-accent-dark border border-[#a5f3fc]/60">
                    LATEST
                  </span>
                )}
              </div>

              {/* Risk Badge */}
              <div>
                {screening.riskLevel === "Moderate risk" ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-primary border border-red-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Moderate risk
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ecfeff] text-accent-dark border border-[#cffafe]">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-dark" />
                    Lower risk
                  </span>
                )}
              </div>
            </div>

            {/* Middle row: Metric & Action button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-muted">Estimated Hb:</span>
                <span className="text-lg sm:text-xl font-extrabold text-heading">
                  {screening.hbRange}
                </span>
                <span className="text-xs text-muted">g/dL</span>
              </div>

              <div>
                <Link
                  href={screening.reportHref}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#eef8f8] hover:bg-[#def2f3] text-accent-dark text-xs sm:text-sm font-semibold transition-colors"
                >
                  <span>View Report</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Bottom: Summary description */}
            <p className="text-xs sm:text-sm text-muted leading-relaxed mt-2 pt-1 border-t border-border/40">
              {screening.summary}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
