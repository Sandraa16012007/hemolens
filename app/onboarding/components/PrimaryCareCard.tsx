"use client";

import { motion } from "framer-motion";
import { Phone, Stethoscope, ShieldCheck } from "lucide-react";

export interface PrimaryCareData {
  doctorName?: string;
  doctorPhone: string;
}

interface PrimaryCareCardProps {
  data: PrimaryCareData;
  onChange: (field: keyof PrimaryCareData, value: string) => void;
}

export default function PrimaryCareCard({
  data,
  onChange,
}: PrimaryCareCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: 0.15 }}
      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.05)" }}
      className="rounded-2xl border border-border bg-white p-5 sm:p-6 transition-all"
      id="primary-care-card"
    >
      {/* Card Header */}
      <div className="flex items-start gap-3 mb-5">
        <div className="p-2 rounded-xl bg-accent/30 text-accent-dark shrink-0">
          <Stethoscope className="w-5 h-5" strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-heading">
            3. Primary Care Provider{" "}
            <span className="font-normal text-muted">• Optional</span>
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Share your doctor or clinic contact for streamlined follow-up
          </p>
        </div>
      </div>

      <div className="space-y-3.5">
        {/* Phone Number Input */}
        <div>
          <label
            htmlFor="doctor-phone-input"
            className="block text-xs font-semibold text-heading mb-1.5"
          >
            Provider / Doctor Phone Number
          </label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              id="doctor-phone-input"
              type="tel"
              placeholder="e.g. +1 (555) 234-5678"
              value={data.doctorPhone}
              onChange={(e) => onChange("doctorPhone", e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>

        {/* Doctor / Clinic Name (Optional secondary field) */}
        <div>
          <label
            htmlFor="doctor-name-input"
            className="block text-xs font-semibold text-heading mb-1.5"
          >
            Doctor or Clinic Name <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="doctor-name-input"
            type="text"
            placeholder="e.g. Dr. Jane Miller or Metro Health Clinic"
            value={data.doctorName || ""}
            onChange={(e) => onChange("doctorName", e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        {/* Privacy Note */}
        <div className="flex items-center gap-1.5 text-xs text-muted pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-accent-dark shrink-0" />
          <span>Used strictly for your personal reports. Never shared with third parties.</span>
        </div>
      </div>
    </motion.div>
  );
}
