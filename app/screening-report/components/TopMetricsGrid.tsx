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
  ImageOff,
  ArrowDown,
} from "lucide-react";
import Image from "next/image";
import ImagePreviewModal from "./ImagePreviewModal";
import type { MLPrediction, ClinicalClassification } from "@/lib/supabase/reportResult";

interface TopMetricsGridProps {
  eyelidImageUrl?: string | null;
  /** Phase 2: ROI-marked eyelid image (outline + translucent mask) */
  eyelidRoiMarkedUrl?: string | null;
  nailbedImageUrl?: string | null;
  /** ROI-marked nail-bed image (numbered nail boxes + inner analysis regions) */
  nailbedRoiMarkedUrl?: string | null;
  reportStatus?: string;
  /** Live ML prediction from backend (null = still pending) */
  mlPrediction?: MLPrediction | null;
  /** WHO 2024 deterministic classification (null = still pending) */
  clinicalClassification?: ClinicalClassification | null;
}

// ─── Risk colour tokens ─────────────────────────────────────────────────────
const RISK_STYLES: Record<
  string,
  { badge: string; highlight: string }
> = {
  normal: {
    badge: "bg-emerald-50 border-emerald-200 text-emerald-800",
    highlight: "bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-xs font-bold",
  },
  mild: {
    badge: "bg-amber-50 border-amber-200 text-amber-800",
    highlight: "bg-amber-50 text-amber-800 border border-amber-200 shadow-xs font-bold",
  },
  moderate: {
    badge: "bg-rose-50 border-rose-200 text-primary",
    highlight: "bg-white text-primary border border-rose-200 shadow-xs font-bold",
  },
  severe: {
    badge: "bg-red-100 border-red-300 text-red-900",
    highlight: "bg-red-100 text-red-900 border border-red-300 shadow-xs font-bold",
  },
  unclassifiable: {
    badge: "bg-surface border-border text-muted",
    highlight: "bg-surface text-muted border border-border shadow-xs font-bold",
  },
};

export default function TopMetricsGrid({
  eyelidImageUrl,
  eyelidRoiMarkedUrl,
  nailbedImageUrl,
  nailbedRoiMarkedUrl,
  reportStatus = "pending",
  mlPrediction,
  clinicalClassification,
}: TopMetricsGridProps) {
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  const isPending = reportStatus === "pending" || reportStatus === "processing";
  const riskCategory = clinicalClassification?.risk_category ?? "unclassifiable";
  const riskStyle = RISK_STYLES[riskCategory] ?? RISK_STYLES.unclassifiable;
  const confidencePct = mlPrediction ? Math.round(mlPrediction.confidence * 100) : 0;

  return (
    <div className="space-y-4" id="top-metrics-grid">
      {/* 2-Card Row: Estimated Hb & Anemia Risk */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {/* Card 1: Estimated Hemoglobin Level */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold tracking-wider uppercase text-muted">
                Estimated Hb Level
              </span>
              <div className="w-7 h-7 rounded-lg bg-accent/30 text-accent-dark flex items-center justify-center">
                <Droplet className="w-3.5 h-3.5" />
              </div>
            </div>

            {isPending || !mlPrediction || typeof mlPrediction.hb_estimate !== "number" || Number.isNaN(mlPrediction.hb_estimate) ? (
              <div className="flex items-baseline gap-1.5 mb-2">
                <span className="text-2xl font-extrabold text-muted tracking-tight">
                  {isPending ? "Awaiting analysis" : "—"}
                </span>
              </div>
            ) : (
              <div className="mb-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl sm:text-4xl font-extrabold text-heading tracking-tight">
                    {mlPrediction.hb_estimate.toFixed(1)}
                  </span>
                  <span className="text-sm font-semibold text-muted">g/dL</span>
                </div>
                {Array.isArray(mlPrediction.hb_range) && mlPrediction.hb_range.length >= 2 && (
                  <div className="text-xs font-semibold text-accent-dark mt-0.5">
                    Estimated Range: {(mlPrediction.hb_range[0] ?? 0).toFixed(1)}–{(mlPrediction.hb_range[1] ?? 0).toFixed(1)} g/dL
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-muted leading-relaxed mb-4">
              {isPending
                ? "Your images have been uploaded and are queued for AI analysis."
                : "Estimated from palpebral conjunctiva optical density analysis."}
            </p>
          </div>

          {!isPending && mlPrediction && (
            <div className="pt-3 border-t border-border/70 space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-muted">
                <span>Patient reading</span>
                <span className="font-semibold text-heading">
                  {typeof mlPrediction.hb_estimate === "number" ? mlPrediction.hb_estimate.toFixed(1) : "—"} g/dL
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted">
                  Reference: {clinicalClassification?.applicable_population ?? "Adult"}
                </span>
                <span className="text-primary font-bold">
                  {riskCategory.toUpperCase()}
                </span>
              </div>
            </div>
          )}
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

            <div className="mb-2">
              {isPending || !clinicalClassification ? (
                <span className="inline-block px-3.5 py-1 rounded-lg bg-surface border border-border text-muted font-bold text-sm tracking-wider">
                  {isPending ? "PENDING" : "—"}
                </span>
              ) : (
                <span
                  className={`inline-block px-3.5 py-1 rounded-lg font-black text-sm sm:text-base tracking-wider border ${riskStyle.badge}`}
                >
                  {riskCategory.toUpperCase()}
                </span>
              )}
            </div>

            <p className="text-xs text-muted leading-relaxed mb-4">
              {isPending
                ? "Risk classification will be available after AI analysis completes."
                : clinicalClassification
                ? `WHO 2024 — ${clinicalClassification.applicable_population}.`
                : "This result suggests a risk of low hemoglobin levels."}
            </p>
          </div>

          <div className="pt-3 border-t border-border/70">
            {/* Risk level indicator bar */}
            <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-surface border border-border text-center text-xs font-semibold">
              {(["normal", "mild", "moderate", "severe"] as const).map((level) => {
                const isActive = !isPending && clinicalClassification?.risk_category === level;
                return (
                  <div
                    key={level}
                    className={`py-1.5 rounded-lg capitalize ${
                      isActive ? riskStyle.highlight : "text-muted"
                    }`}
                  >
                    {level}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>

      {/* 2-Card Row: Result Confidence + Photos View */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 items-stretch">
        {/* Card 3: Result Confidence */}
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
                {isPending || !mlPrediction ? "—" : `${confidencePct}%`}
              </span>
            </div>

            <div className="h-2 w-full rounded-full bg-surface border border-border overflow-hidden p-0.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: isPending || !mlPrediction ? "0%" : `${confidencePct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full bg-accent-dark"
              />
            </div>

            <p className="text-xs text-muted leading-relaxed">
              {isPending
                ? "Confidence score will be computed after AI analysis."
                : "Confidence indicates how strongly the screening model supports this result based on palpebral vascularity and illumination indices. It does not indicate definitive medical certainty."}
            </p>
          </div>

          <div className="pt-3 border-t border-border/70 flex items-center justify-between text-xs text-muted mt-3">
            <span>
              Model Version:{" "}
              <strong>{mlPrediction?.model_version ?? "—"}</strong>
            </span>
            {isPending ? (
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Pending
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Verified
              </span>
            )}
          </div>
        </motion.div>

        {/* Card 4: Uploaded Photos View */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.16 }}
          className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-accent/30 text-accent-dark flex items-center justify-center">
                  <Eye className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs sm:text-sm font-bold text-heading">
                  Uploaded Photos View
                </span>
              </div>
              {eyelidImageUrl && (
                <button
                  type="button"
                  onClick={() => setIsPhotoModalOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-accent-dark hover:underline cursor-pointer"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Expand</span>
                </button>
              )}
            </div>

            {/* Photos Preview Grid — Phase 2: 4-image vertical structure:
                Original Eyelid ↓ ROI-Marked Eyelid | Original Nail ↓ ROI-Marked Nail
                When ROI references are absent, falls back to 2-image grid. */}
            {eyelidRoiMarkedUrl || nailbedRoiMarkedUrl ? (
              <div className="grid grid-cols-2 gap-3 mb-2">
                {/* Eyelid Column */}
                <div className="flex flex-col gap-1.5 items-center">
                  <div
                    onClick={() => eyelidImageUrl && setIsPhotoModalOpen(true)}
                    className={`group relative w-full aspect-16/10 rounded-xl overflow-hidden border border-border bg-surface shadow-xs ${eyelidImageUrl ? "cursor-pointer" : ""}`}
                  >
                    {eyelidImageUrl ? (
                      <>
                        <Image src={eyelidImageUrl} alt="Original Eyelid Image" fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent opacity-90" />
                        <span className="absolute bottom-1.5 left-2 text-[10px] font-bold text-white tracking-wide">Original Eyelid</span>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted"><ImageOff className="w-5 h-5 opacity-50" /><span className="text-[10px]">No image</span></div>
                    )}
                  </div>
                  <ArrowDown className="w-3.5 h-3.5 text-muted" />
                  <div
                    onClick={() => eyelidRoiMarkedUrl && setIsPhotoModalOpen(true)}
                    className={`group relative w-full aspect-16/10 rounded-xl overflow-hidden border border-amber-200 bg-amber-50 shadow-xs ${eyelidRoiMarkedUrl ? "cursor-pointer" : ""}`}
                  >
                    {eyelidRoiMarkedUrl ? (
                      <>
                        <Image src={eyelidRoiMarkedUrl} alt="ROI-Marked Eyelid Image" fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                        <span className="absolute bottom-1.5 left-2 text-[10px] font-bold text-white tracking-wide bg-black/60 px-1.5 py-0.5 rounded">ROI-Marked</span>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted"><ImageOff className="w-5 h-5 opacity-50" /><span className="text-[10px]">ROI pending</span></div>
                    )}
                  </div>
                </div>
                {/* Nail Column */}
                <div className="flex flex-col gap-1.5 items-center">
                  <div
                    onClick={() => nailbedImageUrl && setIsPhotoModalOpen(true)}
                    className={`group relative w-full aspect-16/10 rounded-xl overflow-hidden border border-border bg-surface shadow-xs ${nailbedImageUrl ? "cursor-pointer" : ""}`}
                  >
                    {nailbedImageUrl ? (
                      <>
                        <Image src={nailbedImageUrl} alt="Original Nail-Bed Image" fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent opacity-90" />
                        <span className="absolute bottom-1.5 left-2 text-[10px] font-bold text-white tracking-wide">Original Nail</span>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted"><ImageOff className="w-5 h-5 opacity-50" /><span className="text-[10px] text-center px-1 leading-tight">Nail-bed image not uploaded</span></div>
                    )}
                  </div>
                  <ArrowDown className="w-3.5 h-3.5 text-muted" />
                  <div
                    onClick={() => nailbedRoiMarkedUrl && setIsPhotoModalOpen(true)}
                    className={`group relative w-full aspect-16/10 rounded-xl overflow-hidden border border-amber-200 bg-amber-50 shadow-xs ${nailbedRoiMarkedUrl ? "cursor-pointer" : ""}`}
                  >
                    {nailbedRoiMarkedUrl ? (
                      <>
                        <Image src={nailbedRoiMarkedUrl} alt="ROI-Marked Nail-Bed Image" fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                        <span className="absolute bottom-1.5 left-2 text-[10px] font-bold text-white tracking-wide bg-black/60 px-1.5 py-0.5 rounded">ROI-Marked</span>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted"><ImageOff className="w-5 h-5 opacity-50" /><span className="text-[10px] text-center px-1 leading-tight">ROI pending</span></div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 mb-2">
                {/* Eyelid Photo */}
                <div
                  onClick={() => eyelidImageUrl && setIsPhotoModalOpen(true)}
                  className={`group relative aspect-16/10 rounded-xl overflow-hidden border border-border bg-surface shadow-xs ${eyelidImageUrl ? "cursor-pointer" : ""}`}
                >
                  {eyelidImageUrl ? (
                    <>
                      <Image
                        src={eyelidImageUrl}
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
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted">
                      <ImageOff className="w-5 h-5 opacity-50" />
                      <span className="text-[10px]">No image</span>
                    </div>
                  )}
                </div>

                {/* Nail-bed Photo */}
                <div
                  onClick={() => nailbedImageUrl && setIsPhotoModalOpen(true)}
                  className={`group relative aspect-16/10 rounded-xl overflow-hidden border border-border bg-surface shadow-xs ${nailbedImageUrl ? "cursor-pointer" : ""}`}
                >
                  {nailbedImageUrl ? (
                    <>
                      <Image
                        src={nailbedImageUrl}
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
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted">
                      <ImageOff className="w-5 h-5 opacity-50" />
                      <span className="text-[10px] text-center px-1 leading-tight">
                        Nail-bed image not uploaded
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="pt-2.5 border-t border-border/70 flex items-center justify-between text-xs text-muted">
            <span className="truncate">
              {nailbedImageUrl ? "2 scans uploaded" : "1 scan uploaded"}
            </span>
            {isPending ? (
              <span className="font-semibold text-amber-600">Analysis pending</span>
            ) : (
              <span className="font-semibold text-accent-dark">HD Validated</span>
            )}
          </div>
        </motion.div>
      </div>

      {/* Image Preview Lightbox Modal — Phase 2: passes ROI-marked refs for 4-image structure */}
      <ImagePreviewModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        eyelidImageUrl={eyelidImageUrl}
        eyelidRoiMarkedUrl={eyelidRoiMarkedUrl}
        nailbedImageUrl={nailbedImageUrl}
        nailbedRoiMarkedUrl={nailbedRoiMarkedUrl}
      />
    </div>
  );
}
