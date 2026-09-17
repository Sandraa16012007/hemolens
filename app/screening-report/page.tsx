"use client";

import { useState } from "react";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import ReportHeader from "./components/ReportHeader";
import TopMetricsGrid from "./components/TopMetricsGrid";
import ClinicalInsights from "./components/ClinicalInsights";
import TrendAndHealthcare from "./components/TrendAndHealthcare";
import RegulatorySafeguard from "./components/RegulatorySafeguard";

export default function ScreeningReportPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface flex flex-col lg:flex-row" id="screening-report-page">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Header with Breadcrumb */}
        <DashboardHeader
          onMenuClick={() => setSidebarOpen(true)}
          breadcrumb={{
            backLabel: "Dashboard",
            backHref: "/dashboard",
            title: "Screening Report",
          }}
        />

        {/* Screening Report Main View */}
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-5 sm:space-y-6">
          {/* 1. Header Title & Actions */}
          <ReportHeader />

          {/* 2. Top Metrics (Hb Range, Risk, Confidence) */}
          <TopMetricsGrid />

          {/* 3. Detailed Insights & Trend Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 items-start">
            {/* Left Column: What it means, Factors, Next steps */}
            <ClinicalInsights />

            {/* Right Column: Trend Graph & Nearby Healthcare */}
            <TrendAndHealthcare />
          </div>

          {/* 4. Regulatory & Clinical Safeguard */}
          <RegulatorySafeguard />
        </main>
      </div>
    </div>
  );
}
