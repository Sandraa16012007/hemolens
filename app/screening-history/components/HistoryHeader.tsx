"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, UploadCloud } from "lucide-react";
import { motion } from "framer-motion";
import UploadMedicalReportModal from "./UploadMedicalReportModal";

export default function HistoryHeader() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-2xl border border-border p-5 sm:p-6 mb-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Breadcrumbs + Title + Description */}
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-muted mb-1.5 font-medium" aria-label="Breadcrumb">
            <Link href="/dashboard" className="hover:text-heading transition-colors">
              HemoLens
            </Link>
            <span className="text-muted/60">/</span>
            <span className="text-accent-dark font-semibold">Screening History</span>
          </nav>
          <h1 className="text-xl sm:text-2xl font-bold text-heading tracking-tight mb-1">
            Screening History
          </h1>
          <p className="text-xs sm:text-sm text-muted max-w-xl">
            Review your past screening results and track your estimated hemoglobin levels over time.
          </p>
        </div>

        {/* Right: Actions (Secondary CTA: Add Medical Reports + Primary CTA: Start New Screening) */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Secondary CTA: Add Medical Reports */}
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-border bg-white text-heading text-xs sm:text-sm font-semibold hover:bg-surface hover:border-border/80 active:scale-[0.98] transition-all shadow-xs cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 text-accent-dark" strokeWidth={2} />
            <span>Add Medical Reports</span>
          </button>

          {/* Primary CTA: Start New Screening */}
          <Link
            href="/new-screening"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-xs sm:text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all shadow-sm shadow-primary/20"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Start New Screening</span>
          </Link>
        </div>
      </div>

      {/* Upload Medical Report Modal */}
      <UploadMedicalReportModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </motion.div>
  );
}
