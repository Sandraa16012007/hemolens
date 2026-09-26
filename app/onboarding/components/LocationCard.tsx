"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Search, Compass, Loader2, LocateFixed, AlertCircle, CheckCircle2 } from "lucide-react";
import { getCurrentLocation } from "@/lib/location";

export interface LocationData {
  location: string;
}

interface LocationCardProps {
  data: LocationData;
  onChange: (value: string) => void;
}

export default function LocationCard({ data, onChange }: LocationCardProps) {
  const [isGeoLoading, setIsGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoSuccess, setGeoSuccess] = useState(false);

  const handleUseCurrentLocation = async () => {
    setIsGeoLoading(true);
    setGeoError(null);
    setGeoSuccess(false);

    try {
      const res = await getCurrentLocation();
      onChange(res.formattedLocation);
      setGeoSuccess(true);
      setTimeout(() => setGeoSuccess(false), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to retrieve location.";
      setGeoError(msg);
    } finally {
      setIsGeoLoading(false);
    }
  };

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
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-3">
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

        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isGeoLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 font-medium text-xs transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          title="Detect and populate current location"
        >
          {isGeoLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          ) : (
            <LocateFixed className="w-3.5 h-3.5 text-primary" />
          )}
          <span>{isGeoLoading ? "Detecting..." : "Use Current Location"}</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative mb-2">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          id="location-input"
          type="text"
          placeholder="e.g. Austin, TX or Postal Code"
          value={data.location}
          onChange={(e) => {
            onChange(e.target.value);
            if (geoError) setGeoError(null);
          }}
          className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        />
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isGeoLoading}
          title="Use Current Location"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-muted hover:text-primary hover:bg-slate-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isGeoLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          ) : (
            <LocateFixed className="w-4 h-4" />
          )}
        </button>
      </div>

      {geoError && (
        <p className="mb-2 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{geoError}</span>
        </p>
      )}
      {geoSuccess && (
        <p className="mb-2 text-xs text-emerald-600 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          <span>Location populated successfully!</span>
        </p>
      )}

      {/* Helper notice */}
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <Compass className="w-3.5 h-3.5 text-muted/80 shrink-0" />
        <span>We use this only to display nearby accredited laboratory facilities.</span>
      </div>
    </motion.div>
  );
}
