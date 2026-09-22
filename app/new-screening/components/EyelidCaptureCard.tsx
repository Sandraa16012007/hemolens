"use client";

import { useState, useRef } from "react";
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
import CameraCaptureModal from "./CameraCaptureModal";

export interface SelectedImageData {
  name: string;
  size: string;
  previewUrl?: string;
  file?: File | Blob;
}

interface EyelidCaptureCardProps {
  imageData: SelectedImageData | null;
  onImageChange: (data: SelectedImageData | null) => void;
}

export default function EyelidCaptureCard({
  imageData,
  onImageChange,
}: EyelidCaptureCardProps) {
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
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs"
      id="eyelid-capture-card"
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

          {/* Action Buttons with Hover Animations */}
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

      {/* Selected Image Status Card */}
      {imageData && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-accent/40 bg-accent/15"
        >
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-lg bg-white border border-accent/30 text-accent-dark flex items-center justify-center shrink-0 overflow-hidden">
              {imageData.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageData.previewUrl}
                  alt="Selected eyelid preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-heading truncate max-w-[200px] sm:max-w-xs">
                  {imageData.name}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white text-accent-dark border border-accent/40 text-[10px] font-bold shrink-0">
                  <Check className="w-3 h-3" />
                  Image selected
                </span>
              </div>
              <p className="text-[11px] text-muted mt-0.5">
                {imageData.size} • High optical clarity • Ready for analysis
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRetake}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-dark hover:text-heading transition-colors self-end sm:self-center px-2.5 py-1.5 rounded-md hover:bg-white/60 cursor-pointer active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retake</span>
          </button>
        </motion.div>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        type="eyelid"
        onCapture={handleCameraCapture}
      />
    </motion.div>
  );
}
