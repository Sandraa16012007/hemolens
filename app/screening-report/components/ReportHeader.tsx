"use client";

import { Share2, Download, Check, Stethoscope, Clock } from "lucide-react";
import { useState } from "react";
import ShareToPcpModal from "./ShareToPcpModal";

interface ReportHeaderProps {
  createdAt?: string | null;
  reportStatus?: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ReportHeader({
  createdAt,
  reportStatus = "pending",
}: ReportHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isPcpModalOpen, setIsPcpModalOpen] = useState(false);

  const handleShare = () => {
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      window.print();
    }, 600);
  };

  const isPending = reportStatus === "pending" || reportStatus === "processing";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-heading tracking-tight">
          Your screening result
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs sm:text-sm text-muted">
            {createdAt ? formatDate(createdAt) : "—"} • Preliminary algorithmic screening
          </p>
          {isPending && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">
              <Clock className="w-3 h-3" />
              Analysis pending
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Share with Primary Care Provider */}
        <button
          type="button"
          onClick={() => setIsPcpModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-accent-dark/30 bg-accent/15 text-xs font-semibold text-accent-dark hover:bg-accent/25 hover:border-accent-dark/50 transition-all shadow-xs cursor-pointer"
        >
          <Stethoscope className="w-3.5 h-3.5 shrink-0" />
          <span>Share to PCP</span>
        </button>

        {/* Generic Share */}
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-white text-xs font-semibold text-heading hover:bg-surface transition-colors shadow-xs cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-accent-dark" />
              <span>Link Copied</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5 text-muted" />
              <span>Share</span>
            </>
          )}
        </button>

        {/* Download PDF */}
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-dark text-white text-xs font-semibold hover:bg-accent-dark/90 transition-colors shadow-xs disabled:opacity-70 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{downloading ? "Preparing PDF..." : "Download PDF Report"}</span>
        </button>
      </div>

      <ShareToPcpModal
        isOpen={isPcpModalOpen}
        onClose={() => setIsPcpModalOpen(false)}
      />
    </div>
  );
}
