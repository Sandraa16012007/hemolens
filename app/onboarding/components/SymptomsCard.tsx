"use client";

import { motion } from "framer-motion";
import {
  Activity,
  Moon,
  Accessibility,
  RefreshCw,
  Sparkles,
  Wind,
  CheckCircle2,
  Info,
} from "lucide-react";

export interface SymptomsData {
  selectedSymptoms: string[];
  otherSymptoms: string;
}

interface SymptomsCardProps {
  data: SymptomsData;
  onChange: <K extends keyof SymptomsData>(
    field: K,
    value: SymptomsData[K]
  ) => void;
}

const symptomsList = [
  { id: "fatigue", label: "Fatigue", icon: Moon },
  { id: "weakness", label: "Weakness", icon: Accessibility },
  { id: "dizziness", label: "Dizziness", icon: RefreshCw },
  { id: "pale_skin", label: "Pale skin", icon: Sparkles },
  { id: "short_of_breath", label: "Short of breath", icon: Wind },
  { id: "no_symptoms", label: "No symptoms", icon: CheckCircle2 },
];

export default function SymptomsCard({ data, onChange }: SymptomsCardProps) {
  const toggleSymptom = (id: string) => {
    if (id === "no_symptoms") {
      if (data.selectedSymptoms.includes("no_symptoms")) {
        onChange("selectedSymptoms", []);
      } else {
        onChange("selectedSymptoms", ["no_symptoms"]);
      }
    } else {
      let updated = data.selectedSymptoms.filter((s) => s !== "no_symptoms");
      if (updated.includes(id)) {
        updated = updated.filter((s) => s !== id);
      } else {
        updated.push(id);
      }
      onChange("selectedSymptoms", updated);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.05)" }}
      className="rounded-2xl border border-border bg-white p-5 sm:p-6 transition-all"
      id="symptoms-card"
    >
      {/* Card Header */}
      <div className="flex items-start gap-3 mb-5">
        <div className="p-2 rounded-xl bg-accent/30 text-accent-dark shrink-0">
          <Activity className="w-5 h-5" strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-heading">
            4. Current symptoms
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Select any symptoms experienced over the past 7 days
          </p>
        </div>
      </div>

      {/* Symptoms Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
        {symptomsList.map((item) => {
          const Icon = item.icon;
          const isSelected = data.selectedSymptoms.includes(item.id);
          const isNoSymptoms = item.id === "no_symptoms";

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggleSymptom(item.id)}
              className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? isNoSymptoms
                    ? "border-accent-dark bg-accent/25 ring-1 ring-accent-dark/40 shadow-xs"
                    : "border-primary/60 bg-primary/5 ring-1 ring-primary/30 shadow-xs"
                  : "border-border bg-white hover:bg-surface hover:border-border/80"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`w-4 h-4 ${
                    isSelected
                      ? isNoSymptoms
                        ? "text-accent-dark"
                        : "text-primary"
                      : "text-muted"
                  }`}
                />
                <span
                  className={`text-xs sm:text-sm font-medium ${
                    isSelected ? "text-heading font-semibold" : "text-heading"
                  }`}
                >
                  {item.label}
                </span>
              </div>

              {/* Custom checkbox box */}
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  isSelected
                    ? isNoSymptoms
                      ? "border-accent-dark bg-accent-dark text-white"
                      : "border-primary bg-primary text-white"
                    : "border-border bg-white"
                }`}
              >
                {isSelected && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Additional Symptoms */}
      <div className="mb-4">
        <label
          htmlFor="other-symptoms-input"
          className="block text-xs font-semibold text-heading mb-1.5"
        >
          Other symptoms (optional)
        </label>
        <input
          id="other-symptoms-input"
          type="text"
          placeholder="e.g. Brittle nails, cold extremities, restless legs..."
          value={data.otherSymptoms}
          onChange={(e) => onChange("otherSymptoms", e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        />
      </div>

      {/* Correlation Note */}
      <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface/60 p-3">
        <Info className="w-4 h-4 text-accent-dark shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted leading-relaxed">
          Reported symptoms are correlated with capillary micro-vascular redness
          coefficients during image processing.
        </p>
      </div>
    </motion.div>
  );
}
