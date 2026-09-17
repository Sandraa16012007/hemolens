"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import {
  Upload,
  Camera,
  CheckCircle2,
  Eye,
  RotateCcw,
  Check,
} from "lucide-react";

interface EyelidCaptureCardProps {
  hasImage: boolean;
  onUpload: () => void;
  onRetake: () => void;
}

export default function EyelidCaptureCard({
  hasImage,
  onUpload,
  onRetake,
}: EyelidCaptureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs"
      id="eyelid-capture-card"
    >
      {/* Step Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-full bg-accent-dark text-white text-xs font-bold flex items-center justify-center">
            1
          </span>
          <h2 className="text-base sm:text-lg font-bold text-heading">
            1. Lower-eyelid image
          </h2>
        </div>
        <span className="px-2.5 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-primary text-[11px] font-semibold">
          Required
        </span>
      </div>

      {/* Main 2-Column Content */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center mb-4">
        {/* Left: Image Reference Box */}
        <div className="md:col-span-5 flex flex-col items-center">
          <div className="relative w-full aspect-4/3 rounded-xl overflow-hidden border border-border bg-surface flex items-center justify-center shadow-xs">
            <Image
              src="/assets/exampleEyelid.jpg"
              alt="Target: Palpebral Conjunctiva reference guide"
              fill
              sizes="(max-width: 768px) 100vw, 300px"
              className="object-cover"
              priority
            />
          </div>
          <p className="text-[11px] font-medium text-muted mt-1.5 text-center">
            Target: Palpebral Conjunctiva
          </p>
        </div>

        {/* Right: Instructions & Action Buttons */}
        <div className="md:col-span-7 space-y-3.5">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-heading mb-1">
              Place your lower eyelid clearly in view
            </h3>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              Gently pull down your lower eyelid with a clean finger until the pink conjunctival tissue is fully exposed to the lens.
            </p>
          </div>

          {/* Checklist */}
          <ul className="space-y-1.5 text-xs text-muted">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-accent-dark shrink-0" />
              <span>Use good lighting</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-accent-dark shrink-0" />
              <span>Keep the camera steady</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-accent-dark shrink-0" />
              <span>Make sure the lower eyelid is visible</span>
            </li>
          </ul>

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
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-dark text-white text-xs font-semibold hover:bg-accent-dark/90 transition-colors shadow-xs"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Use Camera</span>
            </button>
          </div>
        </div>
      </div>

      {/* Selected Image Status Card */}
      {hasImage && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-accent/40 bg-accent/15"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white border border-accent/30 text-accent-dark flex items-center justify-center shrink-0">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-heading">
                  eyelid_sample_01.jpg
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white text-accent-dark border border-accent/40 text-[10px] font-bold">
                  <Check className="w-3 h-3" />
                  Image selected
                </span>
              </div>
              <p className="text-[11px] text-muted mt-0.5">
                2.4 MB • High optical clarity • Calibrated
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onRetake}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-dark hover:text-heading transition-colors self-end sm:self-center px-2 py-1 rounded-md hover:bg-white/60"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retake</span>
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
