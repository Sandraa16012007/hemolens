"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check, Loader2, Info, AlertCircle } from "lucide-react";

interface ScreeningBottomBarProps {
  hasEyelidImage: boolean;
  isValid: boolean;
  isValidating: boolean;
  isLoading: boolean;
  onAnalyze: () => void;
}

export default function ScreeningBottomBar({
  hasEyelidImage,
  isValid,
  isValidating,
  isLoading,
  onAnalyze,
}: ScreeningBottomBarProps) {
  const canAnalyze = hasEyelidImage && isValid && !isValidating && !isLoading;

  return (
    <div className="space-y-3 pt-2" id="screening-bottom-bar">
      {/* Action Container Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className="rounded-2xl border border-border bg-white p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4"
      >
        {/* Left: Status Indicator */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {!hasEyelidImage ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface border border-border text-muted text-xs font-medium">
              <span>Lower-eyelid image required</span>
            </div>
          ) : isValidating ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-accent/25 border border-accent/40 text-heading text-xs font-semibold">
              <Loader2 className="w-3.5 h-3.5 text-accent-dark animate-spin" />
              <span>Verifying image quality...</span>
            </div>
          ) : isValid ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-100/70 border border-emerald-300/60 text-emerald-900 text-xs font-semibold">
              <Check className="w-3.5 h-3.5 text-emerald-700 stroke-[2.5]" />
              <span>Ready for AI analysis</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-50 border border-rose-200 text-primary text-xs font-semibold">
              <AlertCircle className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>Image requires retake before analyzing</span>
            </div>
          )}
        </div>

        {/* Right: Analyze Button */}
        <motion.button
          type="button"
          onClick={onAnalyze}
          disabled={!canAnalyze}
          whileHover={canAnalyze ? { scale: 1.02 } : {}}
          whileTap={canAnalyze ? { scale: 0.98 } : {}}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
          id="analyze-screening-button"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving & Analyzing...</span>
            </>
          ) : isValidating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Checking Image...</span>
            </>
          ) : (
            <>
              <span>Analyze My Screening</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </motion.button>
      </motion.div>

      {/* Regulatory Notice */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-muted text-center pt-1">
        <Info className="w-3.5 h-3.5 text-muted/80 shrink-0" />
        <span>
          Your images are used for preliminary screening. HemoLens does not provide a medical diagnosis.
        </span>
      </div>
    </div>
  );
}
