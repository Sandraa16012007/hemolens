"use client";

import { useState } from "react";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import HeroBanner from "./components/HeroBanner";
import QuickActionCards from "./components/QuickActionCards";
import LatestScreening from "./components/LatestScreening";
import { ShieldCheck } from "lucide-react";

import { useSidebar } from "../context/SidebarContext";

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-surface flex flex-col lg:flex-row" id="dashboard-page">
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
        {/* Top Header */}
        <DashboardHeader
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Dashboard Main View */}
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 space-y-4 sm:space-y-5">
          {/* 1. Hero Screening Banner */}
          <HeroBanner />

          {/* 2. Quick Action Cards (Screening History & AI Health Assistant) */}
          <QuickActionCards />

          {/* 3. Latest Screening Metrics */}
          <LatestScreening />

          {/* 4. Footer Regulatory Notice */}
          <footer className="pt-1 pb-4 text-center">
            <div className="inline-flex items-center gap-1.5 text-xs text-muted">
              <ShieldCheck className="w-3.5 h-3.5 text-accent-dark" />
              <span>
                HemoLens is a preliminary screening aid and does not diagnose anemia.
              </span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
