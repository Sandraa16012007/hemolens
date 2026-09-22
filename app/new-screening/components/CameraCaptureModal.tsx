"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Camera,
  RotateCcw,
  Check,
  AlertCircle,
  Sparkles,
} from "lucide-react";

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "eyelid" | "nailbed";
  onCapture: (imageData: {
    name: string;
    previewUrl: string;
    size: string;
    file?: File | Blob;
  }) => void;
}

export default function CameraCaptureModal({
  isOpen,
  onClose,
  type,
  onCapture,
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const isEyelid = type === "eyelid";

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopStream();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasCameraPermission(true);
    } catch (err) {
      console.error("Camera access error:", err);
      setHasCameraPermission(false);
    }
  }, [stopStream]);

  useEffect(() => {
    if (!isOpen) {
      stopStream();
      return;
    }

    let isMounted = true;
    navigator.mediaDevices
      ?.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      .then((stream) => {
        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasCameraPermission(true);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Camera access error:", err);
        setHasCameraPermission(false);
      });

    return () => {
      isMounted = false;
      stopStream();
    };
  }, [isOpen, stopStream]);

  const handleTakeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Mirror snapshot to match user webcam mirror
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      setCapturedImage(dataUrl);
    }
    setIsCapturing(false);
  };

  const handleSaveAndUse = () => {
    if (!capturedImage) return;
    const filename = isEyelid
      ? `eyelid_capture_${Date.now().toString().slice(-4)}.jpg`
      : `nailbed_capture_${Date.now().toString().slice(-4)}.jpg`;

    try {
      const arr = capturedImage.split(",");
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const file = new File([blob], filename, { type: mime });
      const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);

      onCapture({
        name: filename,
        previewUrl: capturedImage,
        size: `${sizeMB} MB`,
        file,
      });
    } catch {
      onCapture({
        name: filename,
        previewUrl: capturedImage,
        size: "1.8 MB",
      });
    }
    onClose();
  };

  const handleRetake = () => {
    setCapturedImage(null);
    if (!streamRef.current) {
      startCamera();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-heading/70 backdrop-blur-xs"
          />

          {/* Modal Card - Compact and non-scrollable */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
            className="relative w-full max-w-md bg-white rounded-2xl border border-border shadow-2xl z-10 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/80">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-accent/30 text-accent-dark flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-heading">
                  {isEyelid ? "Capture Lower Eyelid" : "Capture Nail-Bed"}
                </h3>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-muted hover:text-heading hover:bg-surface transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Instruction Banner */}
            <div className="px-4 py-2 bg-surface border-b border-border/60">
              <p className="text-xs text-muted leading-snug">
                {isEyelid
                  ? "Align your lower eyelid inside the box until the pink conjunctiva is centered."
                  : "Place your fingernail flat and center the nail-bed inside the box under bright light."}
              </p>
            </div>

            {/* Camera Viewfinder Area */}
            <div className="relative aspect-4/3 w-full bg-slate-950 overflow-hidden flex items-center justify-center">
              {/* Hidden canvas for taking snapshot */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Video Element */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 ${
                  capturedImage ? "hidden" : "block"
                }`}
              />

              {/* Captured Photo Preview */}
              {capturedImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={capturedImage}
                  alt="Captured snapshot"
                  className="w-full h-full object-cover"
                />
              )}

              {/* Permission Denied / Error Fallback */}
              {hasCameraPermission === false && (
                <div className="p-4 text-center text-white space-y-2 max-w-xs">
                  <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
                  <p className="text-xs font-semibold">Camera Access Unavailable</p>
                  <p className="text-[11px] text-slate-300">
                    Please allow camera permissions in your browser or choose &quot;Upload Image&quot;.
                  </p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-accent-dark text-white text-xs font-semibold hover:bg-accent-dark/90"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Bounding Box Overlay for Zoomed Alignment */}
              {!capturedImage && hasCameraPermission !== false && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                  {/* Bounding Box Frame */}
                  <div
                    className={`relative w-4/5 h-4/5 rounded-2xl border-2 border-dashed ${
                      isEyelid
                        ? "border-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                        : "border-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                    } transition-all flex flex-col items-center justify-between p-2`}
                  >
                    {/* Corner Guides */}
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-white rounded-tl" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-white rounded-tr" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-white rounded-bl" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-white rounded-br" />

                    {/* Top Guide Text */}
                    <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-[10px] font-semibold text-white tracking-wide">
                      {isEyelid ? "Target: Palpebral Conjunctiva" : "Target: Nail Bed"}
                    </span>

                    {/* Center Crosshair Marker */}
                    <div className="w-5 h-5 rounded-full border border-white/40 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
                    </div>

                    {/* Bottom Guide Text */}
                    <span className="text-[10px] font-medium text-white/80 drop-shadow-xs">
                      Hold steady • Good lighting
                    </span>
                  </div>
                </div>
              )}

              {/* Snapshot confirmation overlay badge */}
              {capturedImage && (
                <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-xs text-white text-[11px] font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span>Snapshot Ready</span>
                </div>
              )}
            </div>

            {/* Bottom Controls Bar */}
            <div className="p-3.5 bg-white border-t border-border flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-semibold text-muted hover:text-heading transition-colors cursor-pointer"
              >
                Cancel
              </button>

              {capturedImage ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-semibold text-heading hover:bg-surface transition-all active:scale-95 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retake</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveAndUse}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-dark text-white text-xs font-bold hover:bg-accent-dark/90 hover:scale-105 active:scale-95 transition-all shadow-xs cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Upload & Save</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleTakeSnapshot}
                  disabled={hasCameraPermission === false || isCapturing}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-accent-dark text-white text-xs font-bold hover:bg-accent-dark/90 hover:scale-105 active:scale-95 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Capture Photo</span>
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
