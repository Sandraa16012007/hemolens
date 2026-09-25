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
import { parseReportResult, ParsedReportResult } from "@/lib/supabase/reportResult";
import { useSidebar } from "../context/SidebarContext";
import type { Screening, Report } from "@/types/database.types";
import type { ScreeningAnalysisResponse } from "@/lib/api/screeningAnalysis";

const DEMO_RESULT: ParsedReportResult = {
  ml_prediction: {
    hb_estimate: 10.6,
    hb_range: [10.2, 11.0],
    confidence: 0.82,
    model_version: "eyelid_hb_model_v1",
  },
  clinical_classification: {
    risk_category: "moderate",
    applicable_population: "Non-pregnant women (≥15 years)",
    threshold_version: "who_2024_hb_v1",
    reference_source: "WHO 2024 Guidelines",
    thresholds_applied: { normal_cutoff: 12.0, mild_floor: 11.0, moderate_floor: 8.0 },
    unclassifiable_reason: null,
    disclaimer: "This is a preliminary screening estimate, not a clinical diagnosis.",
  },
  narrative_report: {
    summary:
      "Your estimated hemoglobin level of 10.6 g/dL suggests a moderate risk of anaemia. Prompt medical evaluation and a confirmatory blood test are advised.",
    explanation:
      "Optical conjunctival analysis indicates noticeable mucosal pallor, consistent with decreased microvascular hemoglobin density. When red blood cell volume is diminished, mucosal capillary beds reflect less red spectrum light.",
    risk_factors: [
      "Palpebral conjunctival microvascular pallor",
      "Self-reported fatigue",
      "Self-reported dizziness",
      "Plant-forward dietary pattern",
    ],
    recommendations: [
      "Consider discussing this result with a healthcare professional or primary care physician.",
      "A laboratory blood test (Complete Blood Count / CBC) is required to confirm whether you have anemia.",
      "Maintain a balanced iron-rich nutritional intake with Vitamin C to support iron absorption.",
    ],
    followup_urgency: "Prompt (within 1-2 weeks)",
    disclaimer:
      "Do not use this preliminary screening result as a medical diagnosis or alter medications autonomously.",
  },
};

function ScreeningReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const screeningId = searchParams.get("screeningId");
  const { isCollapsed } = useSidebar();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [screening, setScreening] = useState<Screening | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedReportResult>(DEMO_RESULT);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasScreeningId = Boolean(screeningId);
  const showLoading = isLoading && hasScreeningId;

  useEffect(() => {
    if (!screeningId) {
      // No screeningId in URL — show the page with static/demo data
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadData() {
      // ── Priority 1: Use cached backend analysis result from sessionStorage ──
      // This is populated immediately after analysis completes and is the most
      // up-to-date source of truth for the report content.
      let sessionAnalysis: ScreeningAnalysisResponse | null = null;
      try {
        const cached = sessionStorage.getItem(`hemolens_analysis_result_${screeningId}`);
        if (cached) {
          sessionAnalysis = JSON.parse(cached) as ScreeningAnalysisResponse;
        }
      } catch {
        // ignore
      }

      if (sessionAnalysis) {
        // Map the backend response directly to ParsedReportResult
        const mappedResult: ParsedReportResult = {
          ml_prediction: {
            hb_estimate: sessionAnalysis.hb_estimate,
            hb_range: sessionAnalysis.hb_range as [number, number],
            confidence: sessionAnalysis.model_confidence,
            model_version: sessionAnalysis.model_version,
          },
          clinical_classification: {
            risk_category: sessionAnalysis.risk_category,
            applicable_population: sessionAnalysis.applicable_reference_population,
            threshold_version: sessionAnalysis.threshold_version,
            reference_source: sessionAnalysis.reference_source,
            thresholds_applied: sessionAnalysis.thresholds_applied as Record<string, number | string> | null,
            unclassifiable_reason: sessionAnalysis.unclassifiable_reason,
            disclaimer: sessionAnalysis.disclaimer,
          },
          narrative_report: sessionAnalysis.report
            ? {
                summary: sessionAnalysis.report.summary ?? "",
                explanation: sessionAnalysis.report.explanation ?? "",
                risk_factors: (sessionAnalysis.report as unknown as Record<string, string[]>).risk_factors
                  ?? (sessionAnalysis.report as unknown as Record<string, string[]>).factors_considered
                  ?? [],
                recommendations: (sessionAnalysis.report as unknown as Record<string, string[]>).recommendations
                  ?? (sessionAnalysis.report as unknown as Record<string, string[]>).recommended_next_steps
                  ?? [],
                followup_urgency: (sessionAnalysis.report as unknown as Record<string, string>).followup_urgency ?? "",
                disclaimer: sessionAnalysis.report.disclaimer ?? "",
              }
            : null,
        };
        setParsedResult(mappedResult);
      }

      // ── Priority 2: Fetch screening record from Supabase ──
      const { data: screeningData, error: screeningError } =
        await getScreeningForReport(screeningId!);

      if (!isMounted) return;

      if (screeningError || !screeningData) {
        if (!sessionAnalysis) {
          // Only show error if we have no cached data to fall back on
          setErrorMessage(
            screeningError?.message ??
              "Screening not found. You may not have access to this report."
          );
        }
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
        // Only override parsedResult from DB if the DB report has actual content
        // (i.e., status is complete/fallback, not pending)
        const dbParsed = parseReportResult(reportData);
        const hasDbContent = dbParsed.ml_prediction !== null;
        if (hasDbContent && !sessionAnalysis) {
          setParsedResult(dbParsed);
        } else if (hasDbContent && sessionAnalysis) {
          // Merge: prefer session data for narrative (most current), but use DB for metadata
          setParsedResult(prev => ({
            ...prev,
            // Keep the session-parsed narrative if richer
            narrative_report: prev.narrative_report ?? dbParsed.narrative_report,
          }));
        }
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
              {(() => {
                let cachedEyelid: string | null = null;
                let cachedNail: string | null = null;
                let cachedEyelidRoi: string | null = null;
                if (typeof window !== "undefined" && screeningId) {
                  try {
                    cachedEyelid = sessionStorage.getItem(`hemolens_eyelid_preview_${screeningId}`);
                    cachedNail = sessionStorage.getItem(`hemolens_nailbed_preview_${screeningId}`);
                    cachedEyelidRoi = sessionStorage.getItem(`hemolens_eyelid_roi_${screeningId}`);
                  } catch {
                    // ignore
                  }
                }

                const effectiveEyelidUrl = screening?.eyelid_image_url || cachedEyelid || null;
                const effectiveEyelidRoiUrl = screening?.eyelid_roi_image_url || cachedEyelidRoi || null;
                const effectiveNailUrl = screening?.nailbed_image_url || cachedNail || null;
                const effectiveNailRoiUrl = screening?.nailbed_roi_image_url || null;

                return (
                  <TopMetricsGrid
                    eyelidImageUrl={effectiveEyelidUrl}
                    eyelidRoiMarkedUrl={effectiveEyelidRoiUrl}
                    nailbedImageUrl={effectiveNailUrl}
                    nailbedRoiMarkedUrl={effectiveNailRoiUrl}
                    reportStatus={report?.status ?? "pending"}
                    mlPrediction={parsedResult.ml_prediction}
                    clinicalClassification={parsedResult.clinical_classification}
                  />
                );
              })()}

              {/* 3. Detailed Insights & Trend Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 items-start">
                <ClinicalInsights narrativeReport={parsedResult.narrative_report} />
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
