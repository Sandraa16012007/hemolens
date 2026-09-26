"use client";

import React from "react";
import { Globe } from "lucide-react";
import { useLanguage, Language } from "@/app/context/LanguageContext";

export default function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();

    const handleToggle = (lang: Language) => {
        setLanguage(lang);
    };

    return (
        <div className="inline-flex items-center bg-surface border border-border rounded-xl p-1 shadow-2xs">
            <div className="flex items-center gap-1.5 px-2 text-muted text-xs font-medium border-r border-border/60 mr-0.5">
                <Globe className="w-3.5 h-3.5 text-muted/80" />
            </div>

            <button
                type="button"
                onClick={() => handleToggle("en")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${language === "en"
                        ? "bg-primary text-white shadow-2xs"
                        : "text-muted hover:text-heading hover:bg-white/60"
                    }`}
                aria-label="Switch to English"
            >
                EN
            </button>

            <button
                type="button"
                onClick={() => handleToggle("hi")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${language === "hi"
                        ? "bg-primary text-white shadow-2xs"
                        : "text-muted hover:text-heading hover:bg-white/60"
                    }`}
                aria-label="हिन्दी में बदलें"
            >
                हिन्दी
            </button>
        </div>
    );
}
