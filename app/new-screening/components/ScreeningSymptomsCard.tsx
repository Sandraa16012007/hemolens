"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";

interface ScreeningSymptomsCardProps {
  selectedSymptoms: string[];
  otherSymptoms: string;
  onToggleSymptom: (id: string) => void;
  onOtherSymptomsChange: (val: string) => void;
}

export default function ScreeningSymptomsCard({
  selectedSymptoms,
  otherSymptoms,
  onToggleSymptom,
  onOtherSymptomsChange,
}: ScreeningSymptomsCardProps) {
  const { t } = useLanguage();

  const symptomsList = [
    { id: "fatigue", label: t("symptoms.fatigue", "Fatigue / Low Energy") },
    { id: "weakness", label: t("symptoms.weakness", "Muscle Weakness") },
    { id: "dizziness", label: t("symptoms.dizziness", "Dizziness / Lightheadedness") },
    { id: "pale_skin", label: t("symptoms.pale_skin", "Pale Skin or Mucosa") },
    { id: "shortness_of_breath", label: t("symptoms.shortness_of_breath", "Shortness of Breath") },
    { id: "no_symptoms", label: t("symptoms.no_symptoms", "No Active Symptoms") },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.12 }}
      className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs"
      id="screening-symptoms-card"
    >
      {/* Step Header */}
      <div className="flex items-center gap-2.5 mb-2">
        <span className="w-6 h-6 rounded-full bg-accent-dark text-white text-xs font-bold flex items-center justify-center">
          3
        </span>
        <h2 className="text-base sm:text-lg font-bold text-heading">
          {t("screening.symptomsCardTitle", "3. Self-Reported Symptoms")}
        </h2>
      </div>

      <p className="text-xs sm:text-sm text-muted mb-4">
        {t("screening.symptomsCardDesc", "Select any symptoms you are currently experiencing.")}
      </p>

      {/* Symptoms Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 mb-4">
        {symptomsList.map((item) => {
          const isSelected = selectedSymptoms.includes(item.id);
          const isNoSymptoms = item.id === "no_symptoms";

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggleSymptom(item.id)}
              className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${isSelected
                  ? isNoSymptoms
                    ? "border-accent-dark bg-accent/25 ring-1 ring-accent-dark/40 shadow-xs"
                    : "border-accent-dark bg-accent/20 ring-1 ring-accent-dark/40 shadow-xs"
                  : "border-border bg-white hover:bg-surface hover:border-border/80"
                }`}
            >
              {/* Checkbox box */}
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected
                    ? "border-accent-dark bg-accent-dark text-white"
                    : "border-border bg-white"
                  }`}
              >
                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
              </div>

              <span
                className={`text-xs sm:text-sm font-medium ${isSelected ? "text-heading font-semibold" : "text-heading"
                  }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Other Symptoms text box */}
      <div>
        <label
          htmlFor="new-screening-other-symptoms"
          className="block text-xs font-semibold text-heading mb-1.5"
        >
          {t("symptoms.otherPlaceholder", "Describe any other symptoms...")}
        </label>
        <input
          id="new-screening-other-symptoms"
          type="text"
          placeholder={t("symptoms.otherPlaceholder", "Describe any other symptoms...")}
          value={otherSymptoms}
          onChange={(e) => onOtherSymptomsChange(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        />
      </div>
    </motion.div>
  );
}
