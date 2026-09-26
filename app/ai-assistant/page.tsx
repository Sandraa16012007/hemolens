"use client";

import { useState, useRef, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import ChatContextBanner from "./components/ChatContextBanner";
import ChatMessageList, { Message } from "./components/ChatMessageList";
import SuggestedPrompts from "./components/SuggestedPrompts";
import ChatInputBar from "./components/ChatInputBar";
import ChatDisclaimer from "./components/ChatDisclaimer";

import { useSidebar } from "../context/SidebarContext";
import { createClient } from "@/lib/supabase/client";
import { getUserScreeningHistory } from "@/lib/supabase/screenings";
import { sendChatMessage } from "@/lib/api/assistant";

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createSessionId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

const GENERIC_GREETING =
  "Hi there! I'm HemoAI, your health assistant. Ask me about anemia screening, iron-rich foods, or next steps.";

export default function AIAssistantPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isCollapsed } = useSidebar();
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [contextLoading, setContextLoading] = useState(true);
  const [banner, setBanner] = useState<{
    riskLabel: string;
    hbLabel: string;
  } | null>(null);
  const [sessionId] = useState<string>(() => createSessionId());
  const [apiError, setApiError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const lastUserMessageRef = useRef<string>("");

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    let mounted = true;

    async function loadContext() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!mounted) return;
        setUserId(user?.id ?? null);

        let riskLabel: string | null = null;
        let hbLabel: string | null = null;

        try {
          const { data: history } = await getUserScreeningHistory();
          if (!mounted) return;
          const latest =
            history && history.length > 0 ? history[0] : null;
          if (
            latest &&
            latest.riskLevel !== "Pending" &&
            latest.riskLevel !== "Unclassifiable" &&
            latest.hbRange !== "—"
          ) {
            riskLabel = latest.riskLevel;
            hbLabel = `${latest.hbRange} g/dL`;
          }
        } catch {
          // Ignore history errors — fall back to generic greeting/banner.
        }

        if (!mounted) return;

        if (riskLabel && hbLabel) {
          setBanner({ riskLabel, hbLabel });
          setMessages([
            {
              id: `greeting-${Date.now()}`,
              sender: "assistant",
              time: formatTime(new Date()),
              text: `Hi there! Your recent screening indicated ${riskLabel.toLowerCase()} (${hbLabel}). How are you feeling today, or what questions can I help answer?`,
            },
          ]);
        } else {
          setBanner(null);
          setMessages([
            {
              id: `greeting-${Date.now()}`,
              sender: "assistant",
              time: formatTime(new Date()),
              text: GENERIC_GREETING,
            },
          ]);
        }
      } catch {
        if (!mounted) return;
        setBanner(null);
        setMessages([
          {
            id: `greeting-${Date.now()}`,
            sender: "assistant",
            time: formatTime(new Date()),
            text: GENERIC_GREETING,
          },
        ]);
      } finally {
        if (mounted) setContextLoading(false);
      }
    }

    loadContext();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSendMessage = async (userText: string) => {
    const trimmed = userText.trim();
    if (!trimmed || isTyping) return;

    if (!userId) {
      setApiError("Please sign in to chat with HemoAI.");
      return;
    }

    const timeStr = formatTime(new Date());
    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: "user",
      time: timeStr,
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    lastUserMessageRef.current = trimmed;
    setIsTyping(true);
    setApiError(null);

    try {
      const reply = await sendChatMessage({
        userId,
        sessionId,
        message: trimmed,
      });
      const botMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: "assistant",
        time: formatTime(new Date()),
        text: reply.message,
        tips: reply.tips,
        disclaimer: reply.disclaimer,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setApiError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsTyping(false);
    }
  };

  const handleRetry = async () => {
    const last = lastUserMessageRef.current.trim();
    if (!last || isTyping) return;

    if (!userId) {
      setApiError("Please sign in to chat with HemoAI.");
      return;
    }

    setIsTyping(true);
    setApiError(null);

    try {
      const reply = await sendChatMessage({
        userId,
        sessionId,
        message: last,
      });
      const botMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: "assistant",
        time: formatTime(new Date()),
        text: reply.message,
        tips: reply.tips,
        disclaimer: reply.disclaimer,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setApiError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsTyping(false);
    }
  };

  const inputDisabled = isTyping || contextLoading;

  return (
    <div className="min-h-screen bg-surface flex flex-col lg:flex-row" id="ai-assistant-page">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          isCollapsed ? "lg:pl-20" : "lg:pl-64"
        }`}
      >
        {/* Top Header with Breadcrumb */}
        <DashboardHeader
          onMenuClick={() => setSidebarOpen(true)}
          breadcrumb={{
            backLabel: "Dashboard",
            backHref: "/dashboard",
            title: "AI Assistant",
          }}
        />

        {/* Main Chat Container */}
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex flex-col justify-between space-y-4">
          {/* Top Context Banner */}
          <ChatContextBanner
            riskLabel={banner?.riskLabel ?? null}
            hbLabel={banner?.hbLabel ?? null}
            loading={contextLoading}
          />

          {/* Conversation History */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 max-h-[calc(100vh-280px)] min-h-[300px]">
            <ChatMessageList messages={messages} isTyping={isTyping} />
            <div ref={chatEndRef} />
          </div>

          {/* Bottom Interactive Area */}
          <div className="space-y-3 pt-2">
            {apiError ? (
              <div
                role="alert"
                className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700"
              >
                <span className="flex-1">{apiError}</span>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : null}

            {/* Suggested Prompts Grid */}
            <div
              className={
                inputDisabled ? "pointer-events-none opacity-60" : undefined
              }
              aria-disabled={inputDisabled}
            >
              <SuggestedPrompts onSelectPrompt={handleSendMessage} />
            </div>

            {/* Chat Input Field */}
            <ChatInputBar
              input={input}
              onInputChange={setInput}
              onSend={handleSendMessage}
              disabled={inputDisabled}
            />

            {/* Footer Disclaimer */}
            <ChatDisclaimer />
          </div>
        </main>
      </div>
    </div>
  );
}
