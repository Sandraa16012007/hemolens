"use client";

import { motion } from "framer-motion";
import { Heart } from "lucide-react";

export interface PregnancyData {
  pregnancyStatus: "Not applicable" | "Pregnant" | "Not pregnant" | "";
}

interface PregnancyCardProps {
  data: PregnancyData;
  onChange: (value: PregnancyData["pregnancyStatus"]) => void;
}

export default function PregnancyCard({ data, onChange }: PregnancyCardProps) {
  const options: Array<"Not applicable" | "Pregnant" | "Not pregnant"> = [
    "Not applicable",
    "Pregnant",
    "Not pregnant",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: 0.1 }}
      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.05)" }}
      className="rounded-2xl border border-border bg-white p-5 sm:p-6 transition-all"
      id="pregnancy-card"
    >
      {/* Card Header */}
      <div className="flex items-start gap-3 mb-5">
        <div className="p-2 rounded-xl bg-accent/30 text-accent-dark shrink-0">
          <Heart className="w-5 h-5" strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-heading">
            5. Pregnancy status
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Iron metabolic demand expands significantly during gestation
          </p>
        </div>
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {options.map((option) => {
          const isSelected = data.pregnancyStatus === option;

          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`flex items-center justify-center gap-2.5 py-3 px-3 rounded-xl border text-xs sm:text-sm font-medium transition-all ${
                isSelected
                  ? "border-accent-dark bg-accent/20 text-heading ring-1 ring-accent-dark/40 shadow-xs"
                  : "border-border bg-white text-muted hover:text-heading hover:bg-surface"
              }`}
            >
              <span
                className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                  isSelected ? "border-accent-dark bg-white" : "border-muted/60"
                }`}
              >
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-dark" />
                )}
              </span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
