"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";

interface SuggestedPromptsProps {
  onSelectPrompt: (prompt: string) => void;
}

export default function SuggestedPrompts({ onSelectPrompt }: SuggestedPromptsProps) {
  const { t } = useLanguage();

  const prompts = [
    t("assistant.prompt1", "What foods are highest in iron for vegetarians?"),
    t("assistant.prompt2", "How does lower eyelid pallor relate to anemia?"),
    t("assistant.prompt3", "What blood tests confirm an anemia diagnosis?"),
    t("assistant.prompt4", "What are the common symptoms of mild anemia?"),
  ];

  return (
    <div className="space-y-2 pt-1" id="suggested-prompts-section">
      <span className="text-[11px] font-bold tracking-wider text-muted uppercase block">
        {t("assistant.title", "HemoLens AI Health Assistant")}
      </span>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {prompts.map((prompt) => (
          <motion.button
            key={prompt}
            type="button"
            onClick={() => onSelectPrompt(prompt)}
            whileHover={{ y: -1, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-between gap-1.5 px-3 py-2 rounded-xl bg-white border border-border text-left text-xs font-semibold text-heading hover:bg-accent/15 hover:border-accent/50 transition-all shadow-xs cursor-pointer"
          >
            <span className="truncate">{prompt}</span>
            <Plus className="w-3.5 h-3.5 text-accent-dark shrink-0" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
