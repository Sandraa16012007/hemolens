"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import en from "@/locales/en.json";
import hi from "@/locales/hi.json";

export type Language = "en" | "hi";

type Translations = Record<string, any>;

const translations: Record<Language, Translations> = {
  en,
  hi,
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "hemolens_lang";

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>("en");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      const savedLang = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (savedLang && (savedLang === "en" || savedLang === "hi")) {
        setLanguageState(savedLang);
      }
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch (e) {
        console.warn("Failed to save language preference to localStorage", e);
      }
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      const dict = translations[language] || translations.en;
      const keys = key.split(".");
      let current: any = dict;

      for (const k of keys) {
        if (current && typeof current === "object" && k in current) {
          current = current[k];
        } else {
          current = undefined;
          break;
        }
      }

      if (typeof current === "string" && current.trim() !== "") {
        return current;
      }

      // Fallback to English dictionary if key missing or empty in active language
      if (language !== "en") {
        let fallbackCurrent: any = translations.en;
        for (const k of keys) {
          if (fallbackCurrent && typeof fallbackCurrent === "object" && k in fallbackCurrent) {
            fallbackCurrent = fallbackCurrent[k];
          } else {
            fallbackCurrent = undefined;
            break;
          }
        }
        if (typeof fallbackCurrent === "string" && fallbackCurrent.trim() !== "") {
          return fallbackCurrent;
        }
      }

      return fallback ?? key;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
