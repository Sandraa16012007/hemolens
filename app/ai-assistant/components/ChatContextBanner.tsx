"use client";

import { Sparkles } from "lucide-react";

interface ChatContextBannerProps {
  riskLabel?: string | null;
  hbLabel?: string | null;
  loading?: boolean;
}

export default function ChatContextBanner({
  riskLabel = null,
  hbLabel = null,
  loading = false,
}: ChatContextBannerProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent/25 border border-accent/40 text-heading text-xs font-semibold shadow-xs">
      <div className="w-5 h-5 rounded-full bg-accent-dark/20 text-accent-dark flex items-center justify-center shrink-0">
        <Sparkles className="w-3 h-3" />
      </div>
      {loading ? (
        <p className="truncate animate-pulse">
          <span className="font-bold text-accent-dark">HemoAI</span>
          <span className="text-muted font-normal"> • Reviewing your recent screening…</span>
        </p>
      ) : riskLabel && hbLabel ? (
        <p className="truncate">
          <span className="font-bold text-accent-dark">HemoAI</span>
          <span className="text-muted font-normal"> • Based on your recent screening (</span>
          <span className="text-primary font-bold">{riskLabel}</span>
          <span className="text-muted font-normal"> • {hbLabel})</span>
        </p>
      ) : (
        <p className="truncate">
          <span className="font-bold text-accent-dark">HemoAI</span>
          <span className="text-muted font-normal">
            {" "}
            • Ask about anemia screening, iron-rich foods, and next steps.
          </span>
        </p>
      )}
    </div>
  );
}
