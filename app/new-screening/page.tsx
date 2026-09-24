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
import { createScreeningWithImages } from "@/lib/supabase/screenings";
import { validateEyelidImage, validateNailImage, ImageValidationState } from "@/lib/api/validation";
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
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    // Strict quality gate: never upload unvalidated or rejected images to Supabase
    if (!eyelidImage || eyelidValidation.status !== "valid") {
      setErrorMessage("Please ensure your lower-eyelid image passes quality validation before proceeding.");
      return;
    }

    // If a nail image was provided, it must also pass validation (or be removed)
    if (nailBedImage && nailValidation.status !== "valid") {
      setErrorMessage("Your nail-bed image failed quality validation. Please retake, upload a new image, or remove it to proceed.");
      return;
    }

    if (isLoading || (eyelidValidation.status as string) === "validating" || (nailValidation.status as string) === "validating") return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await createScreeningWithImages({
        eyelidImage,
        nailBedImage,
        symptoms: {
          selected: selectedSymptoms,
          other: otherSymptoms.trim() || undefined,
        },
      });

      if (error || !data) {
        throw error || new Error("Failed to save screening record.");
      }

      router.push(`/screening-report?screeningId=${data.id}`);
    } catch (err: unknown) {
      console.error("Screening upload error:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to upload screening. Please check your connection and try again.";
      setErrorMessage(msg);
      setIsLoading(false);
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
