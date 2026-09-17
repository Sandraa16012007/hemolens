"use client";

import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

export default function HistoryImportantNote() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.2 }}
      className="mt-6 rounded-2xl bg-[#f0f9ff]/70 border border-[#bae6fd]/70 p-4 sm:p-5 flex items-start gap-3.5"
    >
      <div className="w-8 h-8 rounded-xl bg-[#bae6fd]/60 text-[#0284c7] flex items-center justify-center flex-shrink-0 mt-0.5">
        <ShieldCheck className="w-4 h-4" />
      </div>
      <div>
        <h3 className="text-xs sm:text-sm font-bold text-heading mb-0.5">
          Important Note
        </h3>
        <p className="text-xs sm:text-sm text-muted leading-relaxed">
          Screening results are preliminary estimates and do not replace a medical diagnosis. Please consult a healthcare professional for standard blood testing.
        </p>
      </div>
    </motion.div>
  );
}
