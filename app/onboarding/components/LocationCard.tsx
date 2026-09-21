"use client";

import { motion } from "framer-motion";
import { MapPin, Search, Compass } from "lucide-react";

export interface LocationData {
  location: string;
}

interface LocationCardProps {
  data: LocationData;
  onChange: (value: string) => void;
}

export default function LocationCard({ data, onChange }: LocationCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: 0.15 }}
      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.05)" }}
      className="rounded-2xl border border-border bg-white p-5 sm:p-6 transition-all"
      id="location-card"
    >
      {/* Card Header */}
      <div className="flex items-start gap-3 mb-5">
        <div className="p-2 rounded-xl bg-accent/30 text-accent-dark shrink-0">
          <MapPin className="w-5 h-5" strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-bold text-heading">
            6. Location <span className="font-normal text-muted">• Optional</span>
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Allows referral mapping if clinical follow-up is recommended
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          id="location-input"
          type="text"
          placeholder="e.g. Austin, TX or Postal Code"
          value={data.location}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        />
      </div>

      {/* Helper notice */}
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <Compass className="w-3.5 h-3.5 text-muted/80 shrink-0" />
        <span>We use this only to display nearby accredited laboratory facilities.</span>
      </div>
    </motion.div>
  );
}
