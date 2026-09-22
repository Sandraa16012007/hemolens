"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, X } from "lucide-react";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import EyelidCaptureCard, { SelectedImageData } from "./components/EyelidCaptureCard";
import NailBedCaptureCard from "./components/NailBedCaptureCard";
import ScreeningSymptomsCard from "./components/ScreeningSymptomsCard";
import ScreeningBottomBar from "./components/ScreeningBottomBar";
import { createScreeningWithImages } from "@/lib/supabase/screenings";

export default function NewScreeningPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Form & Image State
  const [eyelidImage, setEyelidImage] = useState<SelectedImageData | null>({
    name: "eyelid_sample_01.jpg",
    size: "2.4 MB",
    previewUrl: "/assets/exampleEyelid.jpg",
  });
  const [nailBedImage, setNailBedImage] = useState<SelectedImageData | null>(null);

  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([
    "fatigue",
    "pale_skin",
  ]);
  const [otherSymptoms, setOtherSymptoms] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    if (!eyelidImage) return;

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
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
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
                  <p className="font-semibold text-primary">Screening Submission Error</p>
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
              Follow the steps below. Your lower-eyelid image is required to run the AI screening model.
            </p>
          </div>

          {/* Step 1: Lower-eyelid image (Required) */}
          <EyelidCaptureCard
            imageData={eyelidImage}
            onImageChange={setEyelidImage}
          />

          {/* Step 2: Nail-bed image (Optional) */}
          <NailBedCaptureCard
            imageData={nailBedImage}
            onImageChange={setNailBedImage}
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
            isLoading={isLoading}
            onAnalyze={handleAnalyze}
          />
        </main>
      </div>
    </div>
  );
}
