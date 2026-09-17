"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check, Loader2, Info } from "lucide-react";

interface ScreeningBottomBarProps {
  hasEyelidImage: boolean;
  isLoading: boolean;
  onAnalyze: () => void;
}

export default function ScreeningBottomBar({
  hasEyelidImage,
  isLoading,
  onAnalyze,
}: ScreeningBottomBarProps) {
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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-accent/25 border border-accent/40 text-heading text-xs font-semibold">
            <Check className="w-3.5 h-3.5 text-accent-dark stroke-[2.5]" />
            <span>Lower-eyelid image added</span>
          </div>
          <span className="text-xs text-muted font-medium">
            • Ready for analysis
          </span>
        </div>

        {/* Right: Analyze Button */}
        <motion.button
          type="button"
          onClick={onAnalyze}
          disabled={!hasEyelidImage || isLoading}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
          id="analyze-screening-button"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analyzing Spectral Data...</span>
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
