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
import { useLanguage } from "../context/LanguageContext";
import { createClient } from "@/lib/supabase/client";
import { getUserScreeningHistory } from "@/lib/supabase/screenings";
import { sendChatMessage, getChatMemory } from "@/lib/api/assistant";

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

function bannerFromMemoryReport(
  report: unknown
): { riskLabel: string; hbLabel: string } | null {
  if (!report || typeof report !== "object") return null;
  const r = report as Record<string, unknown>;
  const riskRaw =
    r["risk_category"] ?? r["riskLabel"] ?? r["risk_label"] ?? r["riskCategory"];
  if (typeof riskRaw !== "string" || !riskRaw.trim()) return null;
  if (riskRaw === "Pending" || riskRaw === "Unclassifiable") return null;
  const hbRaw = r["hb_range"] ?? r["hbRange"] ?? r["hb_label"] ?? r["hbLabel"];
  let hbLabel: string | null = null;
  if (Array.isArray(hbRaw) && hbRaw.length >= 2) {
    const lo = Number(hbRaw[0]);
    const hi = Number(hbRaw[1]);
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      hbLabel = `${lo}–${hi} g/dL`;
    }
  } else if (
    typeof hbRaw === "string" &&
    hbRaw.trim() !== "" &&
    hbRaw.trim() !== "—"
  ) {
    const trimmed = hbRaw.trim();
    hbLabel = trimmed.includes("g/dL") ? trimmed : `${trimmed} g/dL`;
  }
  if (!hbLabel) return null;
  return { riskLabel: riskRaw, hbLabel };
}

export default function AIAssistantPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isCollapsed } = useSidebar();
  const { t } = useLanguage();
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

        if (!user) {
          setBanner(null);
          setMessages([
            {
              id: `greeting-${Date.now()}`,
              sender: "assistant",
              time: formatTime(new Date()),
              text: GENERIC_GREETING,
            },
          ]);
          setApiError("Please sign in to chat with HemoAI.");
          return;
        }

        let historyMessages: Message[] = [];
        let memRiskLabel: string | null = null;
        let memHbLabel: string | null = null;

        try {
          const memory = await getChatMemory();
          if (!mounted) return;
          const convos = Array.isArray(memory.conversations)
            ? memory.conversations.slice(-20)
            : [];
          historyMessages = convos.map((c, idx) => {
            let time = "—";
            if (c.timestamp) {
              const d = new Date(c.timestamp);
              if (!Number.isNaN(d.getTime())) time = formatTime(d);
            }
            const msg: Message = {
              id: `history-${Date.now()}-${idx}`,
              sender: c.role === "user" ? "user" : "assistant",
              time,
              text: c.content,
            };
            return msg;
          });
          const firstReport =
            Array.isArray(memory.reports) && memory.reports.length > 0
              ? memory.reports[0]
              : null;
          if (firstReport) {
            const parsed = bannerFromMemoryReport(firstReport);
            if (parsed) {
              memRiskLabel = parsed.riskLabel;
              memHbLabel = parsed.hbLabel;
            }
          }
        } catch {
          // Ignore memory errors — fall back to screening history.
          historyMessages = [];
        }

        if (!mounted) return;

        if (historyMessages.length > 0) {
          if (memRiskLabel && memHbLabel) {
            setBanner({ riskLabel: memRiskLabel, hbLabel: memHbLabel });
          } else {
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
                setBanner({
                  riskLabel: latest.riskLevel,
                  hbLabel: `${latest.hbRange} g/dL`,
                });
              } else {
                setBanner(null);
              }
            } catch {
              if (!mounted) return;
              setBanner(null);
            }
          }
          if (!mounted) return;
          setMessages(historyMessages);
          return;
        }

        let riskLabel: string | null = memRiskLabel;
        let hbLabel: string | null = memHbLabel;

        if (!riskLabel || !hbLabel) {
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
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isCollapsed ? "lg:pl-20" : "lg:pl-64"
          }`}
      >
        {/* Top Header with Breadcrumb */}
        <DashboardHeader
          onMenuClick={() => setSidebarOpen(true)}
          breadcrumb={{
            backLabel: t("nav.dashboard", "Dashboard"),
            backHref: "/dashboard",
            title: t("nav.aiAssistant", "AI Assistant"),
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
