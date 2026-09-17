"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, ChevronDown, User, Menu } from "lucide-react";

interface DashboardHeaderProps {
  onMenuClick?: () => void;
}

export default function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const [langOpen, setLangOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState("English");

  const languages = ["English", "Spanish", "French", "Hindi"];

  return (
    <header className="w-full bg-white border-b border-border py-3 px-4 sm:px-8 sticky top-0 z-20 shadow-xs">
      <div className="flex items-center justify-between">
        {/* Left (Mobile only): Hamburger Menu + Logo */}
        <div className="flex items-center gap-3 lg:hidden">
          <button
            type="button"
            onClick={onMenuClick}
            className="p-1.5 rounded-lg hover:bg-surface text-heading"
            aria-label="Open sidebar menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/" className="flex items-center">
            <Image
              src="/assets/logo.png"
              alt="HemoLens"
              width={130}
              height={32}
              className="h-7 w-auto object-contain"
              priority
            />
          </Link>
        </div>

        {/* Empty placeholder on desktop to push items to the right */}
        <div className="hidden lg:block" />

        {/* Right side: Language Selector + User Avatar */}
        <div className="flex items-center gap-3 sm:gap-4 ml-auto">
          {/* Language Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-heading hover:bg-surface transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-muted" />
              <span>Language: {selectedLang}</span>
              <ChevronDown
                className={`w-3 h-3 text-muted transition-transform ${
                  langOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            <AnimatePresence>
              {langOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 mt-1 w-36 bg-white border border-border rounded-lg shadow-lg py-1 z-50"
                >
                  {languages.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                        selectedLang === lang
                          ? "bg-accent/20 text-accent-dark font-semibold"
                          : "text-heading hover:bg-surface"
                      }`}
                      onClick={() => {
                        setSelectedLang(lang);
                        setLangOpen(false);
                      }}
                    >
                      {lang}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User Profile Avatar */}
          <Link
            href="/onboarding"
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
