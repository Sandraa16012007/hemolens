"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, ChevronDown } from "lucide-react";

export default function OnboardingHeader() {
  const [langOpen, setLangOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState("English");

  const languages = ["English", "Spanish", "French", "Hindi"];

  return (
    <header className="w-full bg-white border-b border-border py-3 px-4 sm:px-8 sticky top-0 z-30 shadow-xs">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Left: Logo + Step Indicator */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className="flex items-center">
            <Image
              src="/assets/logo.png"
              alt="HemoLens"
              width={160}
              height={40}
              className="h-8 sm:h-9 w-auto object-contain"
              priority
            />
          </Link>

          <div className="hidden sm:block h-6 w-px bg-border" />

          {/* Progress Pill */}
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-accent/30 text-accent-dark text-xs font-bold tracking-tight">
              Step 2 of 3
            </span>
            <span className="hidden md:inline-block text-xs font-medium text-heading">
              Health Profile Setup
            </span>
          </div>
        </div>

        {/* Right: Language Selector + Active Indicator */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-heading hover:bg-surface transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-muted" />
              <span>{selectedLang}</span>
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
                  className="absolute right-0 mt-1 w-32 bg-white border border-border rounded-lg shadow-lg py-1 z-50"
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

          {/* Active status dot */}
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" title="Session active" />
        </div>
      </div>
    </header>
  );
}
