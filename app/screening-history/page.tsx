"use client";

import { useState } from "react";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import HistoryHeader from "./components/HistoryHeader";
import PreviousScreeningsList from "./components/PreviousScreeningsList";
import TrendAndClinicalHelp from "./components/TrendAndClinicalHelp";
import HistoryImportantNote from "./components/HistoryImportantNote";
import { ShieldCheck } from "lucide-react";
import { useSidebar } from "../context/SidebarContext";

export default function ScreeningHistoryPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isCollapsed } = useSidebar();

  return (
    <div
      className="min-h-screen bg-surface flex flex-col lg:flex-row"
      id="screening-history-page"
    >
      {/* Sidebar Navigation */}
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
          breadcrumb={{
            backLabel: "Dashboard",
            backHref: "/dashboard",
            title: "Screening History",
          }}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Page Content Container */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          {/* Top Banner with Breadcrumb and CTA */}
          <HistoryHeader />

          {/* Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (7 cols): Historical Screenings List */}
            <div className="lg:col-span-7">
              <PreviousScreeningsList />
            </div>

            {/* Right Column (5 cols): Trends & Care Options */}
            <div className="lg:col-span-5">
              <TrendAndClinicalHelp />
            </div>
          </div>

          {/* Important Note Footer Banner */}
          <HistoryImportantNote />

          {/* Bottom Regulatory Safeguard */}
          <footer className="mt-8 pb-4 text-center">
            <div className="inline-flex items-center gap-1.5 text-xs text-muted">
              <ShieldCheck className="w-3.5 h-3.5 text-accent-dark" />
              <span>
                HemoLens is an investigational screening aid. Always verify hemoglobin levels via venous blood draw.
              </span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
