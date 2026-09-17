"use client";

import { motion } from "framer-motion";
import { Apple, Check } from "lucide-react";

export interface HealthNutritionData {
  dietaryPattern: "Vegetarian" | "Non-veg" | "Vegan" | "";
  anemiaHistory: "No" | "Yes" | "Not sure" | "";
  medicalConditions: string;
  isNoneConditions: boolean;
}

interface HealthNutritionCardProps {
  data: HealthNutritionData;
  onChange: <K extends keyof HealthNutritionData>(
    field: K,
    value: HealthNutritionData[K]
  ) => void;
}

export default function HealthNutritionCard({
  data,
  onChange,
}: HealthNutritionCardProps) {
  const dietaryOptions: Array<"Vegetarian" | "Non-veg" | "Vegan"> = [
    "Vegetarian",
    "Non-veg",
    "Vegan",
  ];

  const anemiaOptions: Array<"No" | "Yes" | "Not sure"> = [
    "No",
    "Yes",
    "Not sure",
  ];

  const handleNoneToggle = (checked: boolean) => {
    onChange("isNoneConditions", checked);
    if (checked) {
      onChange("medicalConditions", "None");
    } else if (data.medicalConditions === "None") {
      onChange("medicalConditions", "");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: 0.1 }}
      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.05)" }}
      className="rounded-2xl border border-border bg-white p-5 sm:p-6 transition-all"
      id="health-nutrition-card"
    >
      {/* Card Header */}
      <div className="flex items-start gap-3 mb-5">
        <div className="p-2 rounded-xl bg-accent/30 text-accent-dark shrink-0">
          <Apple className="w-5 h-5" strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-heading">
            2. Health and nutrition
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Dietary habits and pre-existing blood factors
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Dietary Pattern */}
        <div>
          <label className="block text-xs font-semibold text-heading mb-2">
            Dietary Pattern
          </label>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {dietaryOptions.map((option) => {
              const isSelected = data.dietaryPattern === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onChange("dietaryPattern", option)}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-2 sm:px-3 rounded-lg border text-xs sm:text-sm font-medium transition-all ${
                    isSelected
                      ? "border-accent-dark bg-accent/20 text-heading ring-1 ring-accent-dark/40 shadow-xs"
                      : "border-border bg-white text-muted hover:text-heading hover:bg-surface"
                  }`}
                >
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-accent-dark shrink-0" />
                  )}
                  <span>{option}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Anemia History */}
        <div>
          <label className="block text-xs font-semibold text-heading mb-2">
            Previous history of anemia?
          </label>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {anemiaOptions.map((option) => {
              const isSelected = data.anemiaHistory === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onChange("anemiaHistory", option)}
                  className={`flex items-center justify-center gap-2 py-2.5 px-2 sm:px-3 rounded-lg border text-xs sm:text-sm font-medium transition-all ${
                    isSelected
                      ? "border-accent-dark bg-accent/20 text-heading ring-1 ring-accent-dark/40 shadow-xs"
                      : "border-border bg-white text-muted hover:text-heading hover:bg-surface"
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors ${
                      isSelected
                        ? "border-accent-dark bg-white"
                        : "border-muted/60"
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
        </div>

        {/* Existing Medical Conditions */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="medical-conditions-input"
              className="text-xs font-semibold text-heading"
            >
              Existing medical conditions
            </label>
            <label className="flex items-center gap-1.5 text-xs text-accent-dark cursor-pointer font-medium hover:underline">
              <input
                type="checkbox"
                checked={data.isNoneConditions}
                onChange={(e) => handleNoneToggle(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-border text-accent-dark focus:ring-accent-dark/30 accent-accent-dark"
              />
              <span>Mark as None</span>
            </label>
          </div>
          <input
            id="medical-conditions-input"
            type="text"
            placeholder="e.g. Celiac disease, CKD, or None"
            value={data.medicalConditions}
            onChange={(e) => {
              onChange("medicalConditions", e.target.value);
              if (data.isNoneConditions && e.target.value !== "None") {
                onChange("isNoneConditions", false);
              }
            }}
            className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
      </div>
    </motion.div>
  );
}
