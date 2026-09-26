"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Camera, Clock, CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/auth";
import { useLanguage } from "@/app/context/LanguageContext";

interface HeroBannerProps {
  onStartScreening?: () => void;
  userName?: string;
}

export default function HeroBanner({ onStartScreening, userName }: HeroBannerProps) {
  const [fetchedName, setFetchedName] = useState<string | null>(null);
  const fullName = userName || fetchedName || "User";
  const { t } = useLanguage();

  useEffect(() => {
    if (userName) return;

    async function fetchUser() {
      try {
        const user = await getCurrentUser();
        if (user?.user_metadata?.full_name) {
          setFetchedName(user.user_metadata.full_name);
        } else if (user?.email) {
          const namePart = user.email.split("@")[0];
          setFetchedName(namePart.charAt(0).toUpperCase() + namePart.slice(1));
        }
      } catch (err) {
        console.error("Failed to load user name:", err);
      }
    }

    fetchUser();
  }, [userName]);

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
            <span>{t("header.tagline", "Non-invasive AI Screening")}</span>
          </div>

          {/* Heading with User's Full Name */}
          <h1 className="text-xl sm:text-2xl font-extrabold text-heading tracking-tight">
            {t("dashboard.readyForNext", "Ready for your next screening?")}, {fullName}?
          </h1>

          {/* Subcopy */}
          <p className="text-xs sm:text-sm text-muted leading-relaxed max-w-xl">
            {t("dashboard.heroSubtitle", "Analyze conjunctival pallor using your smartphone camera for rapid hemoglobin estimation and WHO-calibrated wellness guidance.")}
          </p>

          {/* Feature Badges */}
          <div className="flex flex-wrap items-center gap-3 pt-0.5 text-xs text-muted">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-accent-dark" />
              <span>{t("dashboard.newScreeningDesc", "Capture an eyelid image and check your Hb estimate in minutes.")}</span>
            </div>
            <span className="w-1 h-1 rounded-full bg-border" />
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-accent-dark" />
              <span>{t("dashboard.heroTitle", "Non-Invasive Anemia Screening")}</span>
            </div>
          </div>
        </div>

        {/* Right CTA Button */}
        <div className="shrink-0">
          <Link
            href="/new-screening"
            onClick={onStartScreening}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-primary-hover active:scale-[0.98] transition-all shadow-xs hover:shadow-md cursor-pointer"
            id="start-new-screening-button"
          >
            <Camera className="w-4 h-4" />
            <span>{t("dashboard.startNewScreening", "Start New Screening")}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
