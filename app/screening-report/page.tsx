"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import ReportHeader from "./components/ReportHeader";
import TopMetricsGrid from "./components/TopMetricsGrid";
import ClinicalInsights from "./components/ClinicalInsights";
import TrendAndHealthcare from "./components/TrendAndHealthcare";
import RegulatorySafeguard from "./components/RegulatorySafeguard";
import { getScreeningForReport } from "@/lib/supabase/reports";
import { getOrCreateReport } from "@/lib/supabase/reports";
import { useSidebar } from "../context/SidebarContext";
import type { Screening, Report } from "@/types/database.types";

function ScreeningReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const screeningId = searchParams.get("screeningId");
  const { isCollapsed } = useSidebar();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [screening, setScreening] = useState<Screening | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasScreeningId = Boolean(screeningId);
  const showLoading = isLoading && hasScreeningId;

  useEffect(() => {
    if (!screeningId) {
      // No screeningId in URL — show the page with static/demo data
      return;
    }

    let isMounted = true;

    async function loadData() {
      const { data: screeningData, error: screeningError } =
        await getScreeningForReport(screeningId!);

      if (!isMounted) return;

      if (screeningError || !screeningData) {
        setErrorMessage(
          screeningError?.message ??
            "Screening not found. You may not have access to this report."
        );
        setIsLoading(false);
        return;
      }

      setScreening(screeningData);

      const { data: reportData, error: reportError } = await getOrCreateReport(
        screeningId!,
        screeningData.user_id
      );

      if (!isMounted) return;

      if (reportError) {
        console.warn("Could not load/create report record:", reportError.message);
      } else {
        setReport(reportData);
      }

      setIsLoading(false);
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [screeningId]);

  const handleBackToDashboard = () => router.push("/dashboard");

  return (
    <div className="min-h-screen bg-surface flex flex-col lg:flex-row" id="screening-report-page">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          isCollapsed ? "lg:pl-20" : "lg:pl-64"
        }`}
      >
        <DashboardHeader
          onMenuClick={() => setSidebarOpen(true)}
          breadcrumb={{
            backLabel: "Dashboard",
            backHref: "/dashboard",
            title: "Screening Report",
          }}
        />

        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-5 sm:space-y-6">
          {/* Loading state */}
          {showLoading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted">
              <Loader2 className="w-7 h-7 animate-spin text-accent-dark" />
              <p className="text-sm font-medium">Loading your screening report…</p>
            </div>
          )}

          {/* Error / access denied state */}
          {!showLoading && errorMessage && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 flex flex-col items-center gap-4 text-center">
              <AlertCircle className="w-8 h-8 text-primary" />
              <div>
                <p className="font-bold text-heading text-base mb-1">Report unavailable</p>
                <p className="text-sm text-muted">{errorMessage}</p>
              </div>
              <button
                type="button"
                onClick={handleBackToDashboard}
                className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-dark transition-colors cursor-pointer"
              >
                Back to Dashboard
              </button>
            </div>
          )}

          {/* Loaded report content */}
          {!showLoading && !errorMessage && (
            <>
              {/* 1. Header */}
              <ReportHeader
                createdAt={screening?.created_at ?? null}
                reportStatus={report?.status ?? "pending"}
              />

              {/* 2. Top Metrics + Images */}
              <TopMetricsGrid
                eyelidImageUrl={screening?.eyelid_image_url ?? null}
                nailbedImageUrl={screening?.nailbed_image_url ?? null}
                reportStatus={report?.status ?? "pending"}
              />

              {/* 3. Detailed Insights & Trend Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 items-start">
                <ClinicalInsights />
                <TrendAndHealthcare />
              </div>

              {/* 4. Regulatory Safeguard */}
              <RegulatorySafeguard />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default function ScreeningReportPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface flex items-center justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-accent-dark" />
        </div>
      }
    >
      <ScreeningReportContent />
    </Suspense>
  );
}
