"use client";

import { motion } from "framer-motion";
import { Bot, User, Loader2 } from "lucide-react";

export interface Message {
  id: string;
  sender: "assistant" | "user";
  time: string;
  text: string;
  tips?: string[];
  disclaimer?: string;
}

interface ChatMessageListProps {
  messages: Message[];
  isTyping?: boolean;
}

export default function ChatMessageList({
  messages,
  isTyping,
}: ChatMessageListProps) {
  return (
    <div className="space-y-4" id="chat-message-list">
      {messages.map((message) => {
        const isAssistant = message.sender === "assistant";

        return (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`flex flex-col ${
              isAssistant ? "items-start" : "items-end"
            }`}
          >
            {/* Sender Header */}
            <div
              className={`flex items-center gap-2 mb-1.5 px-1 text-xs ${
                isAssistant ? "flex-row" : "flex-row-reverse"
              }`}
            >
              {isAssistant ? (
                <div className="w-6 h-6 rounded-lg bg-accent/30 text-accent-dark flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-lg bg-slate-800 text-white flex items-center justify-center">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}

              <span className="font-bold text-heading">
                {isAssistant ? "HemoAI" : "You"}
              </span>

              <span className="text-[11px] text-muted">{message.time}</span>
            </div>

            {/* Bubble Container */}
            <div
              className={`max-w-2xl rounded-2xl p-4 sm:p-5 text-xs sm:text-sm leading-relaxed shadow-xs ${
                isAssistant
                  ? "bg-white border border-border text-heading space-y-3"
                  : "bg-accent-dark text-white rounded-tr-xs"
              }`}
            >
              {/* Main text */}
              <p>{message.text}</p>

              {/* Tips Container if available */}
              {message.tips && message.tips.length > 0 && (
                <div className="p-3.5 rounded-xl bg-surface/80 border border-border space-y-1.5 text-xs text-heading">
                  <p className="font-bold text-heading">A few gentle tips to help:</p>
                  <ul className="space-y-1 pl-1">
                    {message.tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-dark mt-1.5 shrink-0" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Disclaimer if available */}
              {message.disclaimer && (
                <p className="text-[11px] text-muted italic border-t border-border/60 pt-2">
                  {message.disclaimer}
                </p>
              )}
            </div>
          </motion.div>
        );
      })}

      {/* Typing indicator */}
      {isTyping && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-xs text-muted"
        >
          <div className="w-6 h-6 rounded-lg bg-accent/30 text-accent-dark flex items-center justify-center">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white border border-border shadow-xs">
            <Loader2 className="w-3.5 h-3.5 text-accent-dark animate-spin" />
            <span className="font-medium text-heading">HemoAI is thinking...</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
