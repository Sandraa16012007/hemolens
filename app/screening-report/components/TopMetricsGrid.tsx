"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Droplet,
  AlertTriangle,
  HelpCircle,
  Eye,
  Maximize2,
  CheckCircle2,
} from "lucide-react";
import Image from "next/image";
import ImagePreviewModal from "./ImagePreviewModal";

export default function TopMetricsGrid() {
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  return (
    <div className="space-y-4" id="top-metrics-grid">
      {/* 2-Card Row: Estimated Hb & Anemia Risk */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {/* Card 1: Estimated Hb Range */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold tracking-wider uppercase text-muted">
                Estimated Hb Range
              </span>
              <div className="w-7 h-7 rounded-lg bg-accent/30 text-accent-dark flex items-center justify-center">
                <Droplet className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Hb Value */}
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-3xl sm:text-4xl font-extrabold text-heading tracking-tight">
                10.2–11.0
              </span>
              <span className="text-sm font-semibold text-muted">g/dL</span>
            </div>

            <p className="text-xs text-muted leading-relaxed mb-4">
              Estimated from palpebral conjunctiva optical density analysis.
            </p>
          </div>

          {/* Baseline Comparisons */}
          <div className="pt-3 border-t border-border/70 space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-muted">
              <span>Patient reading</span>
              <span className="font-semibold text-heading">
                10.6 g/dL <span className="font-normal text-muted">(midpoint)</span>
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted">Typical adult baseline: 12.0–15.5 g/dL</span>
              <span className="text-primary font-bold">
                -1.4 g/dL variance
              </span>
            </div>
          </div>
        </motion.div>

        {/* Card 2: Anemia Risk Level */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
          className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold tracking-wider uppercase text-muted">
                Anemia Risk
              </span>
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-primary flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Risk Badge */}
            <div className="mb-2">
              <span className="inline-block px-3.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-primary font-black text-sm sm:text-base tracking-wider">
                MODERATE
              </span>
            </div>

            <p className="text-xs text-muted leading-relaxed mb-4">
              This result suggests a moderate probability of low hemoglobin levels.
            </p>
          </div>

          {/* 3-Stage Risk Segmented Pill Bar */}
          <div className="pt-3 border-t border-border/70">
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-surface border border-border text-center text-xs font-semibold">
              <div className="py-1.5 rounded-lg text-muted">
                Low
              </div>
              <div className="py-1.5 rounded-lg bg-white text-primary border border-rose-200 shadow-xs font-bold">
                Moderate
              </div>
              <div className="py-1.5 rounded-lg text-muted">
                High
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 2-Card Row: Shortened Result Confidence Card + Photos View Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 items-stretch">
        {/* Card 3: Result Confidence (Shortened) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.12 }}
          className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-heading">
                  Result confidence
                </span>
                <span title="Model confidence estimation" className="inline-flex cursor-pointer">
                  <HelpCircle className="w-3.5 h-3.5 text-muted" />
                </span>
              </div>
              <span className="text-base sm:text-lg font-extrabold text-accent-dark">
                82%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-2 w-full rounded-full bg-surface border border-border overflow-hidden p-0.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "82%" }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full bg-accent-dark"
              />
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Confidence indicates how strongly the screening model supports this result based on palpebral vascularity and illumination indices. It does not indicate definitive medical certainty.
            </p>
          </div>

          <div className="pt-3 border-t border-border/70 flex items-center justify-between text-xs text-muted mt-3">
            <span>Model Version: <strong>v2.4-ensemble</strong></span>
            <span className="flex items-center gap-1 text-emerald-700 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Verified
            </span>
          </div>
        </motion.div>

        {/* Card 4: Uploaded Photos View Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.16 }}
          className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between"
        >
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-accent/30 text-accent-dark flex items-center justify-center">
                  <Eye className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-xs sm:text-sm font-bold text-heading block">
                    Uploaded Photos View
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPhotoModalOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-accent-dark hover:underline cursor-pointer"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Expand</span>
              </button>
            </div>

            {/* Photos Preview Grid */}
            <div className="grid grid-cols-2 gap-2.5 mb-2">
              {/* Eyelid Photo */}
              <div
                onClick={() => setIsPhotoModalOpen(true)}
                className="group relative aspect-16/10 rounded-xl overflow-hidden border border-border bg-surface cursor-pointer shadow-xs"
              >
                <Image
                  src="/assets/exampleEyelid.jpg"
                  alt="Uploaded Eyelid Scan"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent opacity-90 group-hover:opacity-100 transition-opacity" />
                <span className="absolute bottom-1.5 left-2 text-[10px] font-bold text-white tracking-wide">
                  Lower Eyelid
                </span>
                <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 className="w-2.5 h-2.5" />
                </span>
              </div>

              {/* Nailbed Photo */}
              <div
                onClick={() => setIsPhotoModalOpen(true)}
                className="group relative aspect-16/10 rounded-xl overflow-hidden border border-border bg-surface cursor-pointer shadow-xs"
              >
                <Image
                  src="/assets/exampleNailBed.png"
                  alt="Uploaded Nail Bed Scan"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent opacity-90 group-hover:opacity-100 transition-opacity" />
                <span className="absolute bottom-1.5 left-2 text-[10px] font-bold text-white tracking-wide">
                  Nail Bed
                </span>
                <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 className="w-2.5 h-2.5" />
                </span>
              </div>
            </div>
          </div>

          {/* Card Footer */}
          <div className="pt-2.5 border-t border-border/70 flex items-center justify-between text-xs text-muted">
            <span className="truncate">2 scans analyzed by CV pipeline</span>
            <span className="font-semibold text-accent-dark">HD Validated</span>
          </div>
        </motion.div>
      </div>

      {/* Image Preview Lightbox Modal */}
      <ImagePreviewModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
      />
    </div>
  );
}
