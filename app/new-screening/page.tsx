"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, X } from "lucide-react";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import EyelidCaptureCard, { SelectedImageData } from "./components/EyelidCaptureCard";
import NailBedCaptureCard from "./components/NailBedCaptureCard";
import ScreeningSymptomsCard from "./components/ScreeningSymptomsCard";
import ScreeningBottomBar from "./components/ScreeningBottomBar";
import { validateEyelidImage, validateNailImage, ImageValidationState } from "@/lib/api/validation";
import {
  runScreeningAnalysis,
  AnalysisStage,
  ScreeningAnalysisResponse,
  STAGE_LABELS,
} from "@/lib/api/screeningAnalysis";
import { createScreeningWithImages } from "@/lib/supabase/screenings";
import { extractNailFeatures } from "@/lib/api/nailFeatures";
import { useSidebar } from "../context/SidebarContext";

export default function NewScreeningPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isCollapsed } = useSidebar();

  // Form & Image State — Starts empty: asks user to upload first
  const [eyelidImage, setEyelidImage] = useState<SelectedImageData | null>(null);
  const [nailBedImage, setNailBedImage] = useState<SelectedImageData | null>(null);

  // Validation State for Lower Eyelid Image
  const [eyelidValidation, setEyelidValidation] = useState<ImageValidationState>({
    status: "idle",
  });

  // Validation State for Nail-bed Image (optional)
  const [nailValidation, setNailValidation] = useState<ImageValidationState>({
    status: "idle",
  });

  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([
    "fatigue",
    "pale_skin",
  ]);
  const [otherSymptoms, setOtherSymptoms] = useState("");

  // Analysis pipeline state machine
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage>("idle");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [analysisResult, setAnalysisResult] = useState<ScreeningAnalysisResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Derived loading flag — true while the pipeline is in flight
  const isLoading =
    analysisStage !== "idle" &&
    analysisStage !== "completed" &&
    analysisStage !== "error";

  // Active validation request cancellation tokens
  const activeValidationRef = useRef<number>(0);
  const activeNailValidationRef = useRef<number>(0);

  const performImageValidation = useCallback(async (image: SelectedImageData) => {
    const requestId = ++activeValidationRef.current;
    setEyelidValidation({ status: "validating" });
    setErrorMessage(null);

    const source = image.file || image.previewUrl;
    if (!source) {
      setEyelidValidation({
        status: "invalid",
        errorDetail: "No image file or preview data available to validate.",
      });
      return;
    }

    try {
      const result = await validateEyelidImage(source);

      // Discard stale responses if user uploaded another image while validating
      if (requestId !== activeValidationRef.current) return;

      if (result.valid) {
        setEyelidValidation({
          status: "valid",
          message: "Image looks good — your lower eyelid is clearly visible and the image quality is sufficient.",
        });
      } else {
        const errorDetail =
          result.errors && result.errors.length > 0
            ? result.errors[0].message
            : result.message || "Image failed quality validation.";

        setEyelidValidation({
          status: "invalid",
          message: result.message,
          errorDetail,
        });
      }
    } catch (err: unknown) {
      if (requestId !== activeValidationRef.current) return;
      console.error("Validation error:", err);
      setEyelidValidation({
        status: "error",
        message: "Validation service is currently unavailable. Please verify your backend server.",
      });
    }
  }, []);

  // Nail-bed validation callback (mirrors eyelid pattern)
  const performNailValidation = useCallback(async (image: SelectedImageData) => {
    const requestId = ++activeNailValidationRef.current;
    setNailValidation({ status: "validating" });
    setErrorMessage(null);

    const source = image.file || image.previewUrl;
    if (!source) {
      setNailValidation({
        status: "invalid",
        errorDetail: "No image file or preview data available to validate.",
      });
      return;
    }

    try {
      const result = await validateNailImage(source);

      // Discard stale responses if user uploaded another image while validating
      if (requestId !== activeNailValidationRef.current) return;

      if (result.valid) {
        setNailValidation({
          status: "valid",
          message: result.message || `Nail image looks good — ${result.nail_count} fingernail(s) detected.`,
        });
      } else {
        const errorDetail =
          result.errors && result.errors.length > 0
            ? result.errors[0].message
            : result.message || "Nail image failed quality validation.";

        setNailValidation({
          status: "invalid",
          message: result.message,
          errorDetail,
        });
      }
    } catch (err: unknown) {
      if (requestId !== activeNailValidationRef.current) return;
      console.error("Nail validation error:", err);
      setNailValidation({
        status: "error",
        message: "Nail validation service is currently unavailable. Please verify your backend server.",
      });
    }
  }, []);

  // Validate eyelid on image change
  const handleEyelidImageChange = (newImage: SelectedImageData | null) => {
    setEyelidImage(newImage);
    if (!newImage) {
      activeValidationRef.current++;
      setEyelidValidation({ status: "idle" });
      // Reset pipeline state when image is removed
      setAnalysisStage("idle");
      setAnalysisResult(null);
    } else {
      performImageValidation(newImage);
    }
  };

  // Validate nail on image change
  const handleNailImageChange = (newImage: SelectedImageData | null) => {
    setNailBedImage(newImage);
    if (!newImage) {
      activeNailValidationRef.current++;
      setNailValidation({ status: "idle" });
    } else {
      performNailValidation(newImage);
    }
  };

  const handleToggleSymptom = (id: string) => {
    if (id === "no_symptoms") {
      if (selectedSymptoms.includes("no_symptoms")) {
        setSelectedSymptoms([]);
      } else {
        setSelectedSymptoms(["no_symptoms"]);
      }
    } else {
      let updated = selectedSymptoms.filter((s) => s !== "no_symptoms");
      if (updated.includes(id)) {
        updated = updated.filter((s) => s !== id);
      } else {
        updated.push(id);
      }
      setSelectedSymptoms(updated);
    }
  };

  const handleAnalyze = async () => {
    // Quality gate: eyelid must be valid before submitting
    if (!eyelidImage || eyelidValidation.status !== "valid") {
      setErrorMessage("Please ensure your lower-eyelid image passes quality validation before proceeding.");
      return;
    }

    // If a nail image was provided, it must also pass validation (or be removed)
    if (nailBedImage && nailValidation.status !== "valid") {
      setErrorMessage("Your nail-bed image failed quality validation. Please retake, upload a new image, or remove it to proceed.");
      return;
    }

    // Prevent double-submit
    if (isLoading) return;

    setAnalysisStage("uploading");
    setErrorMessage(null);

    // Resolve eyelid blob
    let eyelidBlob: Blob;
    try {
      if (eyelidImage.file) {
        eyelidBlob = eyelidImage.file;
      } else if (eyelidImage.previewUrl) {
        const resp = await fetch(eyelidImage.previewUrl);
        if (!resp.ok) throw new Error("Could not load eyelid image data.");
        eyelidBlob = await resp.blob();
      } else {
        throw new Error("No eyelid image data available.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to prepare image.";
      setErrorMessage(msg);
      setAnalysisStage("error");
      return;
    }

    // Get authenticated user ID (best-effort, non-fatal)
    let userId: string | null = null;
    let profileData: {
      age?: number | null;
      gender?: string | null;
      pregnancy_status?: string | null;
      dietary_pattern?: string | null;
      anemia_history?: string | null;
      chronic_conditions?: string | null;
    } = {};

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id ?? null;

      if (userId) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select(
            "age, gender, pregnancy_status, dietary_pattern, anemia_history, chronic_conditions"
          )
          .eq("id", userId)
          .single();
        if (profile) profileData = profile;
      }
    } catch {
      // non-fatal — proceed without profile enrichment
    }

    let createdScreeningId: string | null = null;

    // Step 1: If user is authenticated, upload images to Supabase storage & create screening row
    if (userId) {
      try {
        const { data: screeningData, error: uploadError } = await createScreeningWithImages({
          eyelidImage: {
            file: eyelidBlob,
            previewUrl: eyelidImage.previewUrl,
            name: eyelidImage.name,
          },
          nailBedImage: nailBedImage
            ? {
                file: nailBedImage.file,
                previewUrl: nailBedImage.previewUrl,
                name: nailBedImage.name,
              }
            : null,
          symptoms: {
            selected: selectedSymptoms,
            other: otherSymptoms.trim() || undefined,
          },
        });

        if (uploadError) {
          console.warn("Could not pre-upload images to Supabase storage:", uploadError.message);
        } else if (screeningData?.id) {
          createdScreeningId = screeningData.id;
        }
      } catch (uploadErr) {
        console.warn("Non-fatal Supabase pre-upload issue:", uploadErr);
      }
    }

    try {
      const result = await runScreeningAnalysis({
        eyelidFile: eyelidBlob,
        screeningId: createdScreeningId,
        userId,
        userAge: profileData.age ?? null,
        userGender: profileData.gender ?? null,
        pregnancyStatus: profileData.pregnancy_status ?? null,
        diet: profileData.dietary_pattern ?? null,
        previousAnemiaHistory: profileData.anemia_history ?? null,
        medicalConditions: profileData.chronic_conditions
          ? [profileData.chronic_conditions]
          : null,
        symptoms: {
          selected: selectedSymptoms,
          other: otherSymptoms.trim() || undefined,
        },
        // Image already passed frontend validation — skip redundant backend re-check
        skipValidation: true,
        onProgress: (p) => setAnalysisStage(p.stage),
      });

      // If backend returned base64 ROI markup, update the screening record in Supabase in background
      if (createdScreeningId && result.roi_marked_image_base64) {
        try {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from("screenings") as any)
            .update({
              eyelid_roi_image_url: result.roi_marked_image_base64,
              status: "completed",
            })
            .eq("id", createdScreeningId);
        } catch {
          // non-fatal
        }
      }

      // If a nail-bed image was provided and validated, extract nail ROI
      // features so the report can show the ROI-marked nail image exactly
      // like the eyelid ROI. Non-fatal: never blocks the report on failure.
      if (nailBedImage && nailValidation.status === "valid") {
        try {
          let nailBlob: Blob;
          if (nailBedImage.file) {
            nailBlob = nailBedImage.file;
          } else if (nailBedImage.previewUrl) {
            const nailResp = await fetch(nailBedImage.previewUrl);
            if (!nailResp.ok) throw new Error("Could not load nail image data.");
            nailBlob = await nailResp.blob();
          } else {
            throw new Error("No nail image data available.");
          }

          const nailResult = await extractNailFeatures(nailBlob, result.screening_id);

          if (nailResult.success && nailResult.roi_marked_image_base64) {
            const nailRoiBase64 = nailResult.roi_marked_image_base64;
            if (createdScreeningId) {
              try {
                const { createClient } = await import("@/lib/supabase/client");
                const supabase = createClient();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from("screenings") as any)
                  .update({
                    nailbed_roi_image_url: nailRoiBase64,
                  })
                  .eq("id", createdScreeningId);
              } catch {
                // non-fatal
              }
            }
            if (typeof window !== "undefined") {
              try {
                sessionStorage.setItem(`hemolens_nail_roi_${result.screening_id}`, nailRoiBase64);
              } catch {
                // ignore storage quota issues
              }
            }
          } else if (!nailResult.success) {
            console.warn("Nail ROI extraction returned no usable ROI (non-fatal):", nailResult.reason);
          }
        } catch (nailErr) {
          console.warn("Non-fatal nail ROI extraction issue:", nailErr);
        }
      }

      // Cache local image previews in sessionStorage for instant display on report page
      if (typeof window !== "undefined") {
        try {
          if (eyelidImage.previewUrl) {
            sessionStorage.setItem(`hemolens_eyelid_preview_${result.screening_id}`, eyelidImage.previewUrl);
          }
          if (nailBedImage?.previewUrl) {
            sessionStorage.setItem(`hemolens_nailbed_preview_${result.screening_id}`, nailBedImage.previewUrl);
          }
          if (result.roi_marked_image_base64) {
            sessionStorage.setItem(`hemolens_eyelid_roi_${result.screening_id}`, result.roi_marked_image_base64);
          }
          // Cache the full analysis result so the report page can use it without waiting for DB
          sessionStorage.setItem(
            `hemolens_analysis_result_${result.screening_id}`,
            JSON.stringify(result)
          );
        } catch {
          // ignore storage quota issues
        }
      }

      setAnalysisResult(result);
      setAnalysisStage("completed");

      // Navigate to report with the persistent screening_id
      router.push(`/screening-report?screeningId=${result.screening_id}`);
    } catch (err: unknown) {
      console.error("Screening analysis error:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to complete screening analysis. Please check your connection and try again.";
      setErrorMessage(msg);
      setAnalysisStage("error");
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col lg:flex-row" id="new-screening-page">
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
            backLabel: "Back to Dashboard",
            backHref: "/dashboard",
            title: "New Screening",
          }}
        />

        {/* Screening Main View */}
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-4 sm:space-y-5">
          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-primary text-xs sm:text-sm flex items-start justify-between gap-3 animate-fadeIn">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-primary">Screening Submission Notice</p>
                  <p className="text-primary/90 mt-0.5">{errorMessage}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-primary hover:text-primary-dark p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Header Title Section */}
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-heading tracking-tight mb-1">
              Let&apos;s check your current anemia risk
            </h1>
            <p className="text-xs sm:text-sm text-muted">
              Follow the steps below. Your lower-eyelid image is verified for quality before running the screening model.
            </p>
          </div>

          {/* Step 1: Lower-eyelid image (Required) */}
          <EyelidCaptureCard
            imageData={eyelidImage}
            onImageChange={handleEyelidImageChange}
            validationState={eyelidValidation}
            onRetryValidation={() => eyelidImage && performImageValidation(eyelidImage)}
          />

          {/* Step 2: Nail-bed image (Optional) */}
          <NailBedCaptureCard
            imageData={nailBedImage}
            onImageChange={handleNailImageChange}
            validationState={nailValidation}
            onRetryValidation={() => nailBedImage && performNailValidation(nailBedImage)}
          />

          {/* Step 3: Current symptoms */}
          <ScreeningSymptomsCard
            selectedSymptoms={selectedSymptoms}
            otherSymptoms={otherSymptoms}
            onToggleSymptom={handleToggleSymptom}
            onOtherSymptomsChange={setOtherSymptoms}
          />

          {/* Analysis pipeline stage indicator */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-dark inline-block animate-pulse" />
              <span className="animate-pulse">{STAGE_LABELS[analysisStage]}</span>
            </div>
          )}

          {/* Bottom Action Bar */}
          <ScreeningBottomBar
            hasEyelidImage={!!eyelidImage}
            isValid={
              eyelidValidation.status === "valid" &&
              (!nailBedImage || nailValidation.status === "valid")
            }
            isValidating={
              eyelidValidation.status === "validating" ||
              nailValidation.status === "validating"
            }
            isLoading={isLoading}
            onAnalyze={handleAnalyze}
          />
        </main>
      </div>
    </div>
  );
}
