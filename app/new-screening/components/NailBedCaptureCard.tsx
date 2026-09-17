"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Upload, Camera, Check, RotateCcw } from "lucide-react";

interface NailBedCaptureCardProps {
  hasImage: boolean;
  onUpload: () => void;
  onRetake: () => void;
}

export default function NailBedCaptureCard({
  hasImage,
  onUpload,
  onRetake,
}: NailBedCaptureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.08 }}
      className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs"
      id="nailbed-capture-card"
    >
      {/* Step Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-slate-200 text-heading text-xs font-bold flex items-center justify-center">
            2
          </span>
          <h2 className="text-base sm:text-lg font-bold text-heading">
            2. Nail-bed image
          </h2>
        </div>
        <span className="px-2.5 py-0.5 rounded-md bg-surface border border-border text-muted text-[11px] font-medium">
          Optional
        </span>
      </div>

      {/* Main 2-Column Content */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        {/* Left: Image Reference Box */}
        <div className="md:col-span-5 flex flex-col items-center">
          <div className="relative w-full aspect-4/3 rounded-xl overflow-hidden border border-border bg-surface flex items-center justify-center shadow-xs">
            <Image
              src="/assets/exampleNailBed.png"
              alt="Reference: Fingernail Bed guide"
              fill
              sizes="(max-width: 768px) 100vw, 300px"
              className="object-cover"
            />
          </div>
          <p className="text-[11px] font-medium text-muted mt-1.5 text-center">
            Reference: Fingernail Bed
          </p>
        </div>

        {/* Right: Instructions & Action Buttons */}
        <div className="md:col-span-7 space-y-3.5">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-heading mb-1">
              Add a nail-bed image to provide additional visual information
            </h3>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              Peripheral capillary refill and subungual pallor augment hemoglobin accuracy. Ensure nails are clean, unpolished, and positioned under indirect daylight.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onUpload}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-surface text-xs font-semibold text-heading hover:bg-surface/80 hover:border-border/80 transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-muted" />
              <span>Upload Image</span>
            </button>
            <button
              type="button"
              onClick={onUpload}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-surface text-xs font-semibold text-heading hover:bg-surface/80 hover:border-border/80 transition-colors"
            >
              <Camera className="w-3.5 h-3.5 text-muted" />
              <span>Use Camera</span>
            </button>
          </div>
        </div>
      </div>

      {/* Selected Optional Image Status Card if uploaded */}
      {hasImage && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-surface"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white border border-border text-accent-dark flex items-center justify-center shrink-0">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-bold text-heading">
                nailbed_sample_01.jpg
              </span>
              <p className="text-[11px] text-muted mt-0.5">
                1.8 MB • Good lighting
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onRetake}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-heading transition-colors self-end sm:self-center px-2 py-1 rounded-md hover:bg-white"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retake</span>
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
