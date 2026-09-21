"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, ZoomIn, Eye, Sparkles, CheckCircle2 } from "lucide-react";
import Image from "next/image";

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: "eyelid" | "nailbed";
}

export default function ImagePreviewModal({
  isOpen,
  onClose,
  initialType = "eyelid",
}: ImagePreviewModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-heading/70 backdrop-blur-xs"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-2xl rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-2xl z-10 overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-accent/30 text-accent-dark">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-heading">
                    Uploaded Screening Scans
                  </h3>
                  <p className="text-xs text-muted">
                    High-resolution biomarker captures analyzed for hemoglobin density
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted hover:text-heading hover:bg-surface transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Images Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 overflow-y-auto">
              {/* Eyelid Scan */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-heading">1. Lower Eyelid Scan</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[10px] border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    ROI Segmented
                  </span>
                </div>

                <div className="relative aspect-4/3 rounded-xl overflow-hidden border border-border bg-black/5">
                  <Image
                    src="/assets/exampleEyelid.jpg"
                    alt="Captured Lower Eyelid Biomarker Scan"
                    fill
                    className="object-cover"
                    priority
                  />
                  <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur-xs text-[10px] text-white font-medium">
                    Palpebral Conjunctiva
                  </div>
                </div>

                <p className="text-[11px] text-muted leading-relaxed">
                  Optical reflectance evaluated mucosal erythema in vascular regions.
                </p>
              </div>

              {/* Nail-bed Scan */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-heading">2. Nail-bed Scan</span>
                  <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent-dark font-semibold text-[10px] border border-accent-dark/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Capillary Validated
                  </span>
                </div>

                <div className="relative aspect-4/3 rounded-xl overflow-hidden border border-border bg-black/5">
                  <Image
                    src="/assets/exampleNailBed.png"
                    alt="Captured Nail Bed Biomarker Scan"
                    fill
                    className="object-cover"
                    priority
                  />
                  <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur-xs text-[10px] text-white font-medium">
                    Subungual Microvasculature
                  </div>
                </div>

                <p className="text-[11px] text-muted leading-relaxed">
                  Capillary bed refill and micro-pallor evaluated as a secondary biomarker.
                </p>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="pt-3 border-t border-border/70 flex items-center justify-between text-xs text-muted">
              <span>Captured on 17 Sep 2026 • Color profile normalized</span>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl bg-surface border border-border text-heading font-semibold hover:bg-border/40 transition-colors"
              >
                Close View
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
