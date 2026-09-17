"use client";

import { motion } from "framer-motion";
import { User, ChevronDown } from "lucide-react";

export interface BasicInfoData {
  age: string;
  gender: string;
  height: string;
  weight: string;
}

interface BasicInfoCardProps {
  data: BasicInfoData;
  onChange: (field: keyof BasicInfoData, value: string) => void;
}

export default function BasicInfoCard({ data, onChange }: BasicInfoCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.05)" }}
      className="rounded-2xl border border-border bg-white p-5 sm:p-6 transition-all"
      id="basic-info-card"
    >
      {/* Card Header */}
      <div className="flex items-start gap-3 mb-5">
        <div className="p-2 rounded-xl bg-accent/30 text-accent-dark shrink-0">
          <User className="w-5 h-5" strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-heading">
            1. Basic information
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Vital metrics used to baseline hemoglobin estimates
          </p>
        </div>
      </div>

      {/* Grid of Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Age */}
        <div>
          <label
            htmlFor="input-age"
            className="block text-xs font-semibold text-heading mb-1.5"
          >
            Age <span className="text-primary">*</span>
          </label>
          <div className="relative">
            <input
              id="input-age"
              type="number"
              min="1"
              max="120"
              placeholder="e.g. 28"
              value={data.age}
              onChange={(e) => onChange("age", e.target.value)}
              className="w-full pl-3.5 pr-12 py-2.5 rounded-lg border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted pointer-events-none">
              yrs
            </span>
          </div>
        </div>

        {/* Biological Sex / Gender */}
        <div>
          <label
            htmlFor="input-gender"
            className="block text-xs font-semibold text-heading mb-1.5"
          >
            Biological Sex / Gender <span className="text-primary">*</span>
          </label>
          <div className="relative">
            <select
              id="input-gender"
              value={data.gender}
              onChange={(e) => onChange("gender", e.target.value)}
              className="w-full pl-3.5 pr-9 py-2.5 rounded-lg border border-border text-sm text-heading bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
            >
              <option value="" disabled>
                Select sex/gender
              </option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          </div>
        </div>

        {/* Height */}
        <div>
          <label
            htmlFor="input-height"
            className="block text-xs font-semibold text-heading mb-1.5"
          >
            Height
          </label>
          <div className="relative">
            <input
              id="input-height"
              type="number"
              min="50"
              max="250"
              placeholder="e.g. 165"
              value={data.height}
              onChange={(e) => onChange("height", e.target.value)}
              className="w-full pl-3.5 pr-12 py-2.5 rounded-lg border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted pointer-events-none">
              cm
            </span>
          </div>
        </div>

        {/* Weight */}
        <div>
          <label
            htmlFor="input-weight"
            className="block text-xs font-semibold text-heading mb-1.5"
          >
            Weight
          </label>
          <div className="relative">
            <input
              id="input-weight"
              type="number"
              min="20"
              max="300"
              placeholder="e.g. 58"
              value={data.weight}
              onChange={(e) => onChange("weight", e.target.value)}
              className="w-full pl-3.5 pr-12 py-2.5 rounded-lg border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted pointer-events-none">
              kg
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
