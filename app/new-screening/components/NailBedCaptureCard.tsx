"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Camera,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RotateCcw,
  Check,
  Loader2,
  RefreshCw,
} from "lucide-react";
import CameraCaptureModal from "./CameraCaptureModal";
import type { SelectedImageData } from "./EyelidCaptureCard";
import type { ImageValidationState } from "@/lib/api/validation";

interface NailBedCaptureCardProps {
  imageData: SelectedImageData | null;
  onImageChange: (data: SelectedImageData | null) => void;
  validationState: ImageValidationState;
  onRetryValidation?: () => void;
}

export default function NailBedCaptureCard({
  imageData,
  onImageChange,
  validationState,
  onRetryValidation,
}: NailBedCaptureCardProps) {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const previewUrl = URL.createObjectURL(file);
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);

      onImageChange({
        name: file.name,
        size: `${sizeMB} MB`,
        previewUrl,
        file,
      });
    }
  };

  const handleCameraCapture = (captured: {
    name: string;
    previewUrl: string;
    size: string;
    file?: File | Blob;
  }) => {
    onImageChange({
      name: captured.name,
      size: captured.size,
      previewUrl: captured.previewUrl,
      file: captured.file,
    });
  };

  const handleRetake = () => {
    onImageChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.08 }}
      className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs"
      id="nailbed-capture-card"
    >
      {/* Hidden File Input for Native File Dialog */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

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
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center mb-4">
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

          {/* Checklist */}
          <ul className="space-y-1.5 text-xs text-muted">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-accent-dark shrink-0" />
              <span>Show 1–3 fingernails clearly</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-accent-dark shrink-0" />
              <span>Clean, unpolished nails</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-accent-dark shrink-0" />
              <span>Good lighting, camera steady</span>
            </li>
          </ul>

          {/* Action Buttons with Hover Animations & matching color for Use Camera */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-surface text-xs font-semibold text-heading hover:bg-surface/80 hover:border-border/80 hover:scale-105 active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-muted" />
              <span>Upload Image</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-dark text-white text-xs font-semibold hover:bg-accent-dark/90 hover:scale-105 active:scale-95 transition-all shadow-xs hover:shadow-md cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Use Camera</span>
            </button>
          </div>
        </div>
      </div>

      {/* Selected Image Status & Validation Card — mirrors EyelidCaptureCard */}
      <AnimatePresence mode="wait">
        {imageData && (
          <motion.div
            key="nailbed-status-card"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className={`flex flex-col gap-3 p-4 rounded-xl border transition-all ${
              validationState.status === "validating"
                ? "border-accent/50 bg-accent/10"
                : validationState.status === "valid"
                ? "border-emerald-200 bg-emerald-50/50"
                : validationState.status === "invalid"
                ? "border-rose-200 bg-rose-50/60"
                : "border-amber-200 bg-amber-50/50"
            }`}
          >
            {/* Top row: thumbnail + file name + status badge + retake */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-12 h-12 rounded-lg bg-white border border-border/80 text-accent-dark flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                  {imageData.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageData.previewUrl}
                      alt="Selected nailbed preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Sparkles className="w-5 h-5 text-muted" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-heading truncate max-w-[180px] sm:max-w-xs">
                      {imageData.name}
                    </span>
                    <span className="text-[11px] text-muted font-medium">
                      ({imageData.size})
                    </span>
                  </div>

                  {/* Status Badges */}
                  <div className="flex items-center gap-2 mt-1">
                    {validationState.status === "validating" && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-accent/30 text-accent-dark text-[11px] font-semibold animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Checking nail image...</span>
                      </span>
                    )}

                    {validationState.status === "valid" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300/60 text-[11px] font-bold">
                        <Check className="w-3 h-3 stroke-[2.5]" />
                        <span>Quality Verified</span>
                      </span>
                    )}

                    {validationState.status === "invalid" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-primary border border-rose-200 text-[11px] font-bold">
                        <AlertCircle className="w-3 h-3" />
                        <span>Needs Retake</span>
                      </span>
                    )}

                    {validationState.status === "error" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold">
                        <AlertCircle className="w-3 h-3" />
                        <span>Check Unavailable</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Retake button */}
              <button
                type="button"
                onClick={handleRetake}
                className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-heading transition-colors px-2.5 py-1.5 rounded-lg border border-border/80 bg-white hover:bg-surface cursor-pointer active:scale-95 shadow-2xs shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retake</span>
              </button>
            </div>

            {/* Detailed validation message feedback box */}
            <div className="pt-2 border-t border-border/50">
              {validationState.status === "validating" && (
                <div className="flex items-center gap-2 text-xs text-muted">
                  <div className="w-2 h-2 rounded-full bg-accent-dark animate-ping" />
                  <span>Evaluating image resolution, blur, lighting, and fingernail detection...</span>
                </div>
              )}

              {validationState.status === "valid" && (
                <div className="flex items-start gap-2.5 text-xs text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-emerald-950">Nail image looks good</p>
                    <p className="text-emerald-800/90 mt-0.5 leading-relaxed">
                      {validationState.message ||
                        "Your fingernail(s) are clearly visible and the image quality is sufficient for analysis."}
                    </p>
                  </div>
                </div>
              )}

              {validationState.status === "invalid" && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2.5 text-xs text-rose-950">
                    <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-primary">Nail image quality issue detected</p>
                      <p className="text-rose-900/90 mt-0.5 leading-relaxed">
                        {validationState.errorDetail ||
                          validationState.message ||
                          "Please retake or re-upload a clear image of your fingernails."}
                      </p>
                    </div>
                  </div>

                  {/* Re-capture quick action buttons */}
                  <div className="flex items-center gap-2 pt-1 pl-6.5">
                    <button
                      type="button"
                      onClick={() => setIsCameraOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-bold hover:bg-primary-dark transition-all active:scale-95 cursor-pointer shadow-xs"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Retake with Camera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-border text-[11px] font-semibold text-heading hover:bg-surface transition-all active:scale-95 cursor-pointer shadow-2xs"
                    >
                      <Upload className="w-3 h-3 text-muted" />
                      <span>Upload Another File</span>
                    </button>
                  </div>
                </div>
              )}

              {validationState.status === "error" && (
                <div className="flex items-center justify-between gap-3 text-xs text-amber-900">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>{validationState.message || "Unable to reach validation backend."}</span>
                  </div>
                  {onRetryValidation && (
                    <button
                      type="button"
                      onClick={onRetryValidation}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-950 underline hover:no-underline cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Retry</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        type="nailbed"
        onCapture={handleCameraCapture}
      />
    </motion.div>
  );
}
