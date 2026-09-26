"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, Sparkles, CheckCircle2, ImageOff, ArrowDown } from "lucide-react";
import Image from "next/image";

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  eyelidImageUrl?: string | null;
  /** Phase 2: ROI-marked eyelid image */
  eyelidRoiMarkedUrl?: string | null;
  nailbedImageUrl?: string | null;
  /** ROI-marked nail-bed image */
  nailbedRoiMarkedUrl?: string | null;
}

export default function ImagePreviewModal({
  isOpen,
  onClose,
  eyelidImageUrl,
  eyelidRoiMarkedUrl,
  nailbedImageUrl,
  nailbedRoiMarkedUrl,
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

            {/* Images Grid — Phase 2: 4-image vertical structure */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-4 overflow-y-auto">
              {/* Eyelid Column: Original ↓ ROI-Marked */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-heading">1. Lower Eyelid</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[10px] border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    ROI Segmented
                  </span>
                </div>
                {/* Original Eyelid */}
                <div className="relative aspect-4/3 rounded-xl overflow-hidden border border-border bg-surface">
                  {eyelidImageUrl ? (
                    <>
                      <Image src={eyelidImageUrl} alt="Original Eyelid Image" fill className="object-cover" priority />
                      <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur-xs text-[10px] text-white font-medium">Original Eyelid Image</div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted"><ImageOff className="w-8 h-8 opacity-40" /><span className="text-xs">No image available</span></div>
                  )}
                </div>
                <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-muted" /></div>
                {/* ROI-Marked Eyelid */}
                <div className="relative aspect-4/3 rounded-xl overflow-hidden border border-amber-200 bg-amber-50">
                  {eyelidRoiMarkedUrl || eyelidImageUrl ? (
                    <>
                      {eyelidRoiMarkedUrl ? (
                        <Image src={eyelidRoiMarkedUrl} alt="ROI-Marked Eyelid Image" fill className="object-cover" priority />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted"><ImageOff className="w-8 h-8 opacity-40" /><span className="text-xs">ROI pending</span></div>
                      )}
                      <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-amber-600/90 backdrop-blur-xs text-[10px] text-white font-medium">ROI-Marked Eyelid Image</div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted"><ImageOff className="w-8 h-8 opacity-40" /><span className="text-xs">No image available</span></div>
                  )}
                </div>
                <p className="text-[11px] text-muted leading-relaxed">Palpebral conjunctiva ROI (triangle + entropy) with translucent mask & outline; features from ROI pixels only.</p>
              </div>

              {/* Nail Column: Original ↓ ROI-Marked (passthrough) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-heading">2. Nail-bed</span>
                  {nailbedImageUrl ? (
                    <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent-dark font-semibold text-[10px] border border-accent-dark/30 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Capillary Validated</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-surface text-muted font-semibold text-[10px] border border-border">Not uploaded</span>
                  )}
                </div>
                {/* Original Nail */}
                <div className="relative aspect-4/3 rounded-xl overflow-hidden border border-border bg-surface">
                  {nailbedImageUrl ? (
                    <>
                      <Image src={nailbedImageUrl} alt="Original Nail-Bed Image" fill className="object-cover" priority />
                      <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur-xs text-[10px] text-white font-medium">Original Nail-Bed Image</div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted"><ImageOff className="w-8 h-8 opacity-40" /><span className="text-xs text-center leading-snug px-4">Nail-bed image not uploaded</span></div>
                  )}
                </div>
                <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-muted" /></div>
                {/* ROI-Marked Nail (passthrough teammate) */}
                <div className="relative aspect-4/3 rounded-xl overflow-hidden border border-amber-200 bg-amber-50">
                  {nailbedRoiMarkedUrl || nailbedImageUrl ? (
                    <>
                      {nailbedRoiMarkedUrl ? (
                        <Image src={nailbedRoiMarkedUrl} alt="ROI-Marked Nail-Bed Image" fill className="object-cover" priority />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted"><ImageOff className="w-8 h-8 opacity-40" /><span className="text-xs text-center px-2">ROI pending</span></div>
                      )}
                      <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-amber-600/90 backdrop-blur-xs text-[10px] text-white font-medium">ROI-Marked Nail-Bed Image</div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted"><ImageOff className="w-8 h-8 opacity-40" /><span className="text-xs text-center leading-snug px-4">Nail-bed image not uploaded</span></div>
                  )}
                </div>
                <p className="text-[11px] text-muted leading-relaxed">{nailbedImageUrl ? "Numbered nail-plate ROIs with inner analysis regions (nail RGB optical analysis) — secondary biomarker." : "Upload a nail-bed image during screening for supplementary analysis."}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-border/70 flex items-center justify-between text-xs text-muted">
              <span>Color profile normalized • HemoLens AI screening</span>
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
