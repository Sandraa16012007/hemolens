"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, Maximize2, ImageOff, ArrowDown } from "lucide-react";
import Image from "next/image";
import ImagePreviewModal from "./ImagePreviewModal";

interface UploadedPhotosCardProps {
  eyelidImageUrl?: string | null;
  /** Phase 2: ROI-marked eyelid image (outline + translucent mask) */
  eyelidRoiMarkedUrl?: string | null;
  nailbedImageUrl?: string | null;
  /** Phase 2 passthrough: teammate-produced ROI-marked nail-bed image */
  nailbedRoiMarkedUrl?: string | null;
  reportStatus?: string;
}

export default function UploadedPhotosCard({
  eyelidImageUrl,
  eyelidRoiMarkedUrl,
  nailbedImageUrl,
  nailbedRoiMarkedUrl,
  reportStatus = "pending",
}: UploadedPhotosCardProps) {
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const isPending = reportStatus === "pending" || reportStatus === "processing";

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.12 }}
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
                      <Image
                        src={eyelidImageUrl}
                        alt="Original Eyelid Image"
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent opacity-90" />
                      <span className="absolute bottom-1.5 left-2 text-[10px] font-bold text-white tracking-wide">
                        Original Eyelid
                      </span>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted">
                      <ImageOff className="w-5 h-5 opacity-50" />
                      <span className="text-[10px]">No image</span>
                    </div>
                  )}
                </div>
                <ArrowDown className="w-3.5 h-3.5 text-muted" />
                <div
                  onClick={() => eyelidRoiMarkedUrl && setIsPhotoModalOpen(true)}
                  className={`group relative w-full aspect-16/10 rounded-xl overflow-hidden border border-amber-200 bg-amber-50 shadow-xs ${eyelidRoiMarkedUrl ? "cursor-pointer" : ""}`}
                >
                  {eyelidRoiMarkedUrl ? (
                    <>
                      <Image
                        src={eyelidRoiMarkedUrl}
                        alt="ROI-Marked Eyelid Image"
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute bottom-1.5 left-2 text-[10px] font-bold text-white tracking-wide bg-black/60 px-1.5 py-0.5 rounded">
                        ROI-Marked
                      </span>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted">
                      <ImageOff className="w-5 h-5 opacity-50" />
                      <span className="text-[10px]">ROI pending</span>
                    </div>
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
                      <Image
                        src={nailbedImageUrl}
                        alt="Original Nail-Bed Image"
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent opacity-90" />
                      <span className="absolute bottom-1.5 left-2 text-[10px] font-bold text-white tracking-wide">
                        Original Nail
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
                <ArrowDown className="w-3.5 h-3.5 text-muted" />
                <div
                  onClick={() => nailbedRoiMarkedUrl && setIsPhotoModalOpen(true)}
                  className={`group relative w-full aspect-16/10 rounded-xl overflow-hidden border border-amber-200 bg-amber-50 shadow-xs ${nailbedRoiMarkedUrl ? "cursor-pointer" : ""}`}
                >
                  {nailbedRoiMarkedUrl ? (
                    <>
                      <Image
                        src={nailbedRoiMarkedUrl}
                        alt="ROI-Marked Nail-Bed Image"
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute bottom-1.5 left-2 text-[10px] font-bold text-white tracking-wide bg-black/60 px-1.5 py-0.5 rounded">
                        ROI-Marked
                      </span>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted">
                      <ImageOff className="w-5 h-5 opacity-50" />
                      <span className="text-[10px] text-center px-1 leading-tight">
                        ROI pending (teammate)
                      </span>
                    </div>
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

      {/* Image Preview Lightbox Modal */}
      <ImagePreviewModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        eyelidImageUrl={eyelidImageUrl}
        eyelidRoiMarkedUrl={eyelidRoiMarkedUrl}
        nailbedImageUrl={nailbedImageUrl}
        nailbedRoiMarkedUrl={nailbedRoiMarkedUrl}
      />
    </>
  );
}
