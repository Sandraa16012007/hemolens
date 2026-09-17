"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { History, Bot, ArrowRight } from "lucide-react";

export default function QuickActionCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5" id="quick-action-cards">
      {/* Card 1: Screening History */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.05)" }}
        className="rounded-2xl border border-border bg-white p-5 flex flex-col justify-between transition-all"
        id="card-screening-history"
      >
        <div>
          <div className="w-9 h-9 rounded-xl bg-accent/30 text-accent-dark flex items-center justify-center mb-3">
            <History className="w-4 h-4" strokeWidth={1.8} />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-heading mb-1">
            Screening History
          </h2>
          <p className="text-xs sm:text-sm text-muted leading-relaxed mb-4">
            Review your previous screening results, dates, and historical trends.
          </p>
        </div>

        <div>
          <Link
            href="/screening-history"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface border border-border text-xs sm:text-sm font-semibold text-heading hover:bg-accent/20 hover:text-accent-dark hover:border-accent/40 active:scale-[0.98] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
            id="btn-view-history"
          >
            <span>View History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </motion.div>

      {/* Card 2: AI Health Assistant */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.12 }}
        whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.05)" }}
        className="rounded-2xl border border-border bg-white p-5 flex flex-col justify-between transition-all"
        id="card-ai-assistant"
      >
        <div>
          <div className="w-9 h-9 rounded-xl bg-accent/30 text-accent-dark flex items-center justify-center mb-3">
            <Bot className="w-4 h-4" strokeWidth={1.8} />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-heading mb-1">
            AI Health Assistant
          </h2>
          <p className="text-xs sm:text-sm text-muted leading-relaxed mb-4">
            Ask questions about your results, symptoms, dietary iron, and health next steps.
          </p>
        </div>

        <div>
          <Link
            href="/ai-assistant"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface border border-border text-xs sm:text-sm font-semibold text-heading hover:bg-accent/20 hover:text-accent-dark hover:border-accent/40 active:scale-[0.98] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
            id="btn-talk-to-hemoai"
          >
            <span>Talk to HemoAI</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
