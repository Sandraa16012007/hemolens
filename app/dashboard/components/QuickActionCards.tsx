"use client";

import { motion } from "framer-motion";
import { History, Bot, ArrowRight } from "lucide-react";

export default function QuickActionCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="quick-action-cards">
      {/* Card 1: Screening History */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        whileHover={{ y: -3, boxShadow: "0 10px 28px rgba(0,0,0,0.06)" }}
        className="rounded-2xl border border-border bg-white p-6 flex flex-col justify-between transition-all"
        id="card-screening-history"
      >
        <div>
          <div className="w-10 h-10 rounded-xl bg-accent/30 text-accent-dark flex items-center justify-center mb-4">
            <History className="w-5 h-5" strokeWidth={1.8} />
          </div>
          <h2 className="text-lg font-bold text-heading mb-1.5">
            Screening History
          </h2>
          <p className="text-xs sm:text-sm text-muted leading-relaxed mb-6">
            Review your previous screening results, dates, and historical trends.
          </p>
        </div>

        <div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface border border-border text-xs sm:text-sm font-semibold text-heading hover:bg-accent/20 hover:text-accent-dark hover:border-accent/40 transition-colors"
          >
            <span>View History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>

      {/* Card 2: AI Health Assistant */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        whileHover={{ y: -3, boxShadow: "0 10px 28px rgba(0,0,0,0.06)" }}
        className="rounded-2xl border border-border bg-white p-6 flex flex-col justify-between transition-all"
        id="card-ai-assistant"
      >
        <div>
          <div className="w-10 h-10 rounded-xl bg-accent/30 text-accent-dark flex items-center justify-center mb-4">
            <Bot className="w-5 h-5" strokeWidth={1.8} />
          </div>
          <h2 className="text-lg font-bold text-heading mb-1.5">
            AI Health Assistant
          </h2>
          <p className="text-xs sm:text-sm text-muted leading-relaxed mb-6">
            Ask questions about your results, symptoms, dietary iron, and health next steps.
          </p>
        </div>

        <div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface border border-border text-xs sm:text-sm font-semibold text-heading hover:bg-accent/20 hover:text-accent-dark hover:border-accent/40 transition-colors"
          >
            <span>Talk to HemoAI</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
