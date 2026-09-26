"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpDown, ArrowRight, Loader2, AlertCircle, ClipboardList } from "lucide-react";
import { getUserScreeningHistory, type ScreeningHistoryItem } from "@/lib/supabase/screenings";

function RiskBadge({ riskLevel }: { riskLevel: ScreeningHistoryItem["riskLevel"] }) {
  if (riskLevel === "High risk" || riskLevel === "Moderate risk" || riskLevel === "Severe risk") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-primary border border-red-200">
        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
        {riskLevel}
      </span>
    );
  }
  if (riskLevel === "Mild risk") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Mild risk
      </span>
    );
  }
  if (riskLevel === "Pending") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ecfeff] text-accent-dark border border-[#cffafe]">
      <span className="w-1.5 h-1.5 rounded-full bg-accent-dark" />
      {riskLevel}
    </span>
  );
}



export default function PreviousScreeningsList() {
  const [sortOrder, setSortOrder] = useState<"recent" | "oldest">("recent");
  const [items, setItems] = useState<ScreeningHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setIsLoading(true);
      setErrorMessage(null);
      const { data, error } = await getUserScreeningHistory();
      if (!mounted) return;
      if (error) {
        setErrorMessage(error.message);
      } else {
        setItems(data);
      }
      setIsLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, []);

  const screenings = [...items].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return sortOrder === "recent" ? dateB - dateA : dateA - dateB;
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-heading">Previous Screenings</h2>
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted">
          <Loader2 className="w-6 h-6 animate-spin text-accent-dark" />
          <p className="text-sm font-medium">Loading screening history...</p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-heading">Previous Screenings</h2>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-7 h-7 text-primary" />
          <p className="font-semibold text-heading text-sm">Could not load history</p>
          <p className="text-xs text-muted">{errorMessage}</p>
        </div>
      </div>
    );
  }

  if (screenings.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-1">
          <h2 className="text-base sm:text-lg font-bold text-heading">Previous Screenings</h2>
          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-accent/40 text-accent-dark border border-accent/60">0</span>
        </div>
        <div className="rounded-2xl border border-dashed border-border bg-white p-10 flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-muted" />
          </div>
          <div>
            <p className="font-bold text-heading text-sm mb-1">No screenings yet</p>
            <p className="text-xs text-muted max-w-xs">Once you complete a screening, it will appear here with its risk summary and Hb estimate.</p>
          </div>
          <Link href="/new-screening" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-dark text-white text-xs font-semibold hover:bg-accent-dark/90 transition-colors">
            Start your first screening
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

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
              screening.isLatest && sortOrder === "recent"
                ? "border-border border-l-4 border-l-primary"
                : "border-border"
            }`}
          >
            {/* Top row: Date + Badges */}
            <div className="flex items-center justify-between gap-3 mb-2.5 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-bold text-heading">
                  {screening.formattedDate}
                </span>
                {screening.isLatest && sortOrder === "recent" && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#e0f7f8] text-accent-dark border border-[#a5f3fc]/60">
                    LATEST
                  </span>
                )}
              </div>

              {/* Risk Badge */}
              <RiskBadge riskLevel={screening.riskLevel} />
            </div>

            {/* Middle row: Metric & Action button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-muted">Estimated Hb:</span>
                <span className="text-lg sm:text-xl font-extrabold text-heading">
                  {screening.hbRange}
                </span>
                {screening.hbRange !== "—" && (
                  <span className="text-xs text-muted">g/dL</span>
                )}
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
