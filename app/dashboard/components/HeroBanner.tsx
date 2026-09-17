"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Camera, Clock, CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react";

interface HeroBannerProps {
  onStartScreening?: () => void;
}

export default function HeroBanner({ onStartScreening }: HeroBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs overflow-hidden"
      style={{ borderLeft: "4px solid #0d9488" }}
      id="hero-screening-banner"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* Left Content */}
        <div className="space-y-2.5">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-accent/30 text-accent-dark text-[11px] font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Non-Invasive Optical Screening</span>
          </div>

          {/* Heading */}
          <h1 className="text-xl sm:text-2xl font-extrabold text-heading tracking-tight">
            Ready for your next screening?
          </h1>

          {/* Subcopy */}
          <p className="text-xs sm:text-sm text-muted leading-relaxed max-w-xl">
            Check your current anemia risk using a lower-eyelid image.
          </p>

          {/* Feature Badges */}
          <div className="flex flex-wrap items-center gap-3 pt-0.5 text-xs text-muted">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-accent-dark" />
              <span>Quick 2-minute check</span>
            </div>
            <span className="w-1 h-1 rounded-full bg-border" />
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-accent-dark" />
              <span>Needle-free</span>
            </div>
          </div>
        </div>

        {/* Right CTA Button */}
        <div className="shrink-0">
          <Link href="/new-screening" className="block">
            <motion.button
              type="button"
              onClick={onStartScreening}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-primary-dark transition-colors shadow-xs cursor-pointer"
              id="start-new-screening-button"
            >
              <Camera className="w-4 h-4" />
              <span>Start New Screening</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
