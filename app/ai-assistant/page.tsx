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

export default function AIAssistantPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isCollapsed } = useSidebar();
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initial Conversation State matching layout mockup
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg-1",
      sender: "assistant",
      time: "10:42 AM",
      text: "Hi Alex! Your recent screening indicated a moderate risk of anemia. How are you feeling today, or what questions can I help answer?",
    },
    {
      id: "msg-2",
      sender: "user",
      time: "10:43 AM",
      text: "Why am I feeling dizzy?",
    },
    {
      id: "msg-3",
      sender: "assistant",
      time: "10:43 AM",
      text: "When hemoglobin is slightly low, your body carries less oxygen, which can cause lightheadedness or fatigue—especially when standing up quickly.",
      tips: [
        "Stay well hydrated throughout the day",
        "Incorporate iron-rich foods (spinach, beans, lentils)",
        "Rest when you feel fatigued",
      ],
      disclaimer:
        "Remember, this screening is an early guide. We recommend scheduling a simple routine blood test with your doctor to verify your iron levels.",
    },
  ]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = (userText: string) => {
    if (!userText.trim()) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: "user",
      time: timeStr,
      text: userText,
    };

    setMessages((prev) => [...prev, newMsg]);
    setIsTyping(true);

    // Simulate intelligent contextual response
    setTimeout(() => {
      let botResponse = "";
      let botTips: string[] | undefined = undefined;

      const lower = userText.toLowerCase();

      if (lower.includes("food") || lower.includes("eat") || lower.includes("diet")) {
        botResponse =
          "Focusing on bioavailable iron sources helps support hemoglobin synthesis. Pair plant-based iron with Vitamin C to increase absorption.";
        botTips = [
          "Heme iron: lean poultry, fish, eggs",
          "Non-heme iron: dark leafy greens, chickpeas, fortified whole grains",
          "Vitamin C boosters: bell peppers, citrus fruits, tomatoes",
        ];
      } else if (lower.includes("doctor") || lower.includes("see a doctor") || lower.includes("clinic")) {
        botResponse =
          "Yes, we encourage scheduling a primary care consultation. Since HemoLens is an optical screening tool, your physician can order a Complete Blood Count (CBC) and serum ferritin panel to confirm your status.";
        botTips = [
          "Bring your HemoLens screening report to your visit",
          "Mention your current symptoms and dietary habits",
        ];
      } else if (lower.includes("how does") || lower.includes("work") || lower.includes("screening")) {
        botResponse =
          "HemoLens analyzes palpebral conjunctiva tissue from your lower eyelid photo. By measuring micro-vascular redness coefficients and spectral optical density, it estimates approximate hemoglobin concentrations.";
      } else if (lower.includes("energy") || lower.includes("tired") || lower.includes("fatigue")) {
        botResponse =
          "Fatigue is one of the most common signs when cellular oxygen delivery is reduced.";
        botTips = [
          "Prioritize 7-8 hours of quality restorative sleep",
          "Avoid heavy caffeine right after meals as it inhibits iron uptake",
          "Stay consistently hydrated throughout the afternoon",
        ];
      } else {
        botResponse = `Thanks for asking. Based on your screening range (10.2–11.0 g/dL), supporting your red blood cell health through balanced nutrition and proper rest is a great first step.`;
        botTips = [
          "Monitor any changes in fatigue or lightheadedness",
          "Consult a doctor for confirmatory diagnostic lab tests",
        ];
      }

      const botMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: "assistant",
        time: timeStr,
        text: botResponse,
        tips: botTips,
        disclaimer:
          "HemoLens provides educational wellness insights and does not substitute for medical evaluation.",
      };

      setIsTyping(false);
      setMessages((prev) => [...prev, botMsg]);
    }, 1000);
  };

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
          <ChatContextBanner />

          {/* Conversation History */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 max-h-[calc(100vh-280px)] min-h-[300px]">
            <ChatMessageList messages={messages} isTyping={isTyping} />
            <div ref={chatEndRef} />
          </div>

          {/* Bottom Interactive Area */}
          <div className="space-y-3 pt-2">
            {/* Suggested Prompts Grid */}
            <SuggestedPrompts onSelectPrompt={handleSendMessage} />

            {/* Chat Input Field */}
            <ChatInputBar
              input={input}
              onInputChange={setInput}
              onSend={handleSendMessage}
              disabled={isTyping}
            />

            {/* Footer Disclaimer */}
            <ChatDisclaimer />
          </div>
        </main>
      </div>
    </div>
  );
}
