"use client";

import { motion } from "framer-motion";
import { Camera, Sparkles, ArrowRight } from "lucide-react";

interface EmptyScreeningStateProps {
  onStartScreening?: () => void;
}

export default function EmptyScreeningState({
  onStartScreening,
}: EmptyScreeningStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white p-8 sm:p-10 text-center">
      <div className="w-14 h-14 rounded-2xl bg-accent/25 text-accent-dark mx-auto flex items-center justify-center mb-4">
        <Sparkles className="w-7 h-7" strokeWidth={1.8} />
      </div>

      <h3 className="text-base sm:text-lg font-bold text-heading mb-1.5">
        No screenings yet
      </h3>

      <p className="text-xs sm:text-sm text-muted max-w-md mx-auto leading-relaxed mb-6">
        Take your first quick photo check to see your estimated hemoglobin
        range and personalized risk analysis here.
      </p>

      <motion.button
        type="button"
        onClick={onStartScreening}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-xs sm:text-sm font-semibold hover:bg-primary-dark transition-colors shadow-xs"
      >
        <Camera className="w-4 h-4" />
        <span>Start New Screening</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </motion.button>
    </div>
  );
}
