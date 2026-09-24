"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mic, X, Send, ArrowRight } from "lucide-react";

interface ChatInputBarProps {
  input: string;
  onInputChange: (val: string) => void;
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInputBar({
  input,
  onInputChange,
  onSend,
  disabled,
}: ChatInputBarProps) {
  const [isListening, setIsListening] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input);
      onInputChange("");
    }
  };

  const handleMicToggle = () => {
    setIsListening(!isListening);
    if (!isListening) {
      onInputChange("How can I boost my dietary iron naturally?");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative flex items-center gap-2 p-1.5 rounded-2xl bg-white border border-border shadow-xs"
      id="chat-input-form"
    >
      {/* Text input */}
      <input
        type="text"
        placeholder="Ask a question about your health, foods, or symptoms..."
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        disabled={disabled}
        className="flex-1 pl-3 pr-2 py-2 text-xs sm:text-sm placeholder:text-muted/60 focus:outline-none bg-transparent text-heading"
      />

      {/* Clear Button */}
      {input.length > 0 && (
        <button
          type="button"
          onClick={() => onInputChange("")}
          className="p-1.5 rounded-lg hover:bg-surface text-muted hover:text-heading transition-colors"
          title="Clear input"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Voice Mic Button */}
      <button
        type="button"
        onClick={handleMicToggle}
        className={`p-2 rounded-xl transition-all ${isListening
            ? "bg-rose-100 text-primary animate-pulse ring-2 ring-primary/30"
            : "text-muted hover:text-heading hover:bg-surface"
          }`}
        title={isListening ? "Listening..." : "Voice input"}
      >
        <Mic className="w-4 h-4" />
      </button>

      {/* Send Button */}
      <motion.button
        type="submit"
        disabled={!input.trim() || disabled}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent-dark text-white text-xs sm:text-sm font-semibold hover:bg-accent-dark/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
        id="send-chat-button"
      >
        <span>Send</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </motion.button>
    </form>
  );
}
