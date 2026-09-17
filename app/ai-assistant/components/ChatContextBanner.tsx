"use client";

import { Sparkles } from "lucide-react";

export default function ChatContextBanner() {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent/25 border border-accent/40 text-heading text-xs font-semibold shadow-xs">
      <div className="w-5 h-5 rounded-full bg-accent-dark/20 text-accent-dark flex items-center justify-center shrink-0">
        <Sparkles className="w-3 h-3" />
      </div>
      <p className="truncate">
        <span className="font-bold text-accent-dark">HemoAI</span>
        <span className="text-muted font-normal"> • Based on your recent screening (</span>
        <span className="text-primary font-bold">Moderate risk</span>
        <span className="text-muted font-normal"> • 10.2–11.0 g/dL)</span>
      </p>
    </div>
  );
}
