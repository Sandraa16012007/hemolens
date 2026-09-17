"use client";

import { motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";

interface OnboardingFooterProps {
  onSubmit: () => void;
  isLoading: boolean;
}

export default function OnboardingFooter({
  onSubmit,
  isLoading,
}: OnboardingFooterProps) {
  return (
    <footer className="w-full bg-white border-t border-border py-4 px-4 sm:px-8 mt-10 shadow-lg shadow-black/[0.03]">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left: Disclaimer Notice */}
        <div className="flex items-center gap-2 text-xs text-muted text-center sm:text-left">
          <span className="w-2 h-2 rounded-full bg-accent-dark shrink-0" />
          <span>
            Preliminary screening aid • Non-diagnostic investigational tool
          </span>
        </div>

        {/* Right: Helper Text + Submit Button */}
        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
          <span className="hidden md:inline-block text-xs text-muted">
            You can update profile details later
          </span>

          <motion.button
            type="button"
            onClick={onSubmit}
            disabled={isLoading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary-dark transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-xs"
            id="save-and-continue-button"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Profile...</span>
              </>
            ) : (
              <>
                <span>Save and Continue</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </motion.button>
        </div>
      </div>
    </footer>
  );
}
