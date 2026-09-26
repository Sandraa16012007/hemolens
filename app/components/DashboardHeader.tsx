"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { User, Menu, ArrowLeft } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";
import { useLanguage } from "../context/LanguageContext";

interface DashboardHeaderProps {
  onMenuClick?: () => void;
  breadcrumb?: {
    backLabel: string;
    backHref: string;
    title: string;
  };
}

export default function DashboardHeader({
  onMenuClick,
  breadcrumb,
}: DashboardHeaderProps) {
  const [langOpen, setLangOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState("English");
  const { t } = useLanguage();

  const languages = ["English", "Hindi", "Bengali", "Malayalam"];

  return (
    <header className="w-full bg-white border-b border-border py-3 px-4 sm:px-8 sticky top-0 z-20 shadow-xs">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile Drawer Trigger / Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="p-1.5 rounded-lg hover:bg-surface text-heading lg:hidden"
            aria-label="Open sidebar menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo on mobile when no breadcrumb, or always on small view */}
          <div className="lg:hidden">
            <Link href="/" className="flex items-center">
              <Image
                src="/assets/logo.png"
                alt="HemoLens"
                width={140}
                height={36}
                className="h-7 w-auto object-contain"
                priority
              />
            </Link>
          </div>

          {/* Desktop/Tablet Breadcrumb if provided */}
          {breadcrumb && (
            <div className="hidden sm:flex items-center gap-3">
              <Link
                href={breadcrumb.backHref}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-heading transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>
                  {breadcrumb.backLabel === "Dashboard"
                    ? t("nav.dashboard", "Dashboard")
                    : breadcrumb.backLabel === "Screening History"
                      ? t("nav.screeningHistory", "Screening History")
                      : breadcrumb.backLabel}
                </span>
              </Link>
              <div className="h-4 w-px bg-border" />
              <span className="text-sm font-bold text-heading">
                {breadcrumb.title === "Dashboard"
                  ? t("nav.dashboard", "Dashboard")
                  : breadcrumb.title === "New Screening"
                    ? t("nav.newScreening", "New Screening")
                    : breadcrumb.title === "Screening History"
                      ? t("nav.screeningHistory", "Screening History")
                      : breadcrumb.title === "AI Assistant"
                        ? t("nav.aiAssistant", "AI Assistant")
                        : breadcrumb.title === "Profile"
                          ? t("nav.profile", "Profile")
                          : breadcrumb.title}
              </span>
            </div>
          )}
        </div>

        {/* Right side: Language Selector + User Avatar */}
        <div className="flex items-center gap-3 sm:gap-4 ml-auto">
          {/* Language Switcher */}
          <LanguageSwitcher />

          {/* User Profile Avatar */}
          <Link
            href="/profile"
            className="relative w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center hover:ring-2 hover:ring-primary/30 transition-all"
            title="User Profile"
          >
            <User className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
