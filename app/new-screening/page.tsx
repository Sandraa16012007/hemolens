"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import EyelidCaptureCard from "./components/EyelidCaptureCard";
import NailBedCaptureCard from "./components/NailBedCaptureCard";
import ScreeningSymptomsCard from "./components/ScreeningSymptomsCard";
import ScreeningBottomBar from "./components/ScreeningBottomBar";
import { CheckCircle2 } from "lucide-react";

export default function NewScreeningPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Form State
  const [hasEyelidImage, setHasEyelidImage] = useState(true);
  const [hasNailBedImage, setHasNailBedImage] = useState(false);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([
    "fatigue",
    "pale_skin",
  ]);
  const [otherSymptoms, setOtherSymptoms] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzed, setIsAnalyzed] = useState(false);

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

  const handleAnalyze = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsAnalyzed(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 1200);
    }, 1500);
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
          {/* Header Title Section */}
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-heading tracking-tight mb-1">
              Let&apos;s check your current anemia risk
            </h1>
            <p className="text-xs sm:text-sm text-muted">
              Follow the steps below. Your lower-eyelid image is required to run the AI screening model.
            </p>
          </div>

          {/* Success Toast */}
          <AnimatePresence>
            {isAnalyzed && (
              <motion.div
                initial={{ opacity: 0, y: -15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-center gap-2 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Screening analysis complete! Redirecting to dashboard results...</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step 1: Lower-eyelid image (Required) */}
          <EyelidCaptureCard
            hasImage={hasEyelidImage}
            onUpload={() => setHasEyelidImage(true)}
            onRetake={() => setHasEyelidImage(false)}
          />

          {/* Step 2: Nail-bed image (Optional) */}
          <NailBedCaptureCard
            hasImage={hasNailBedImage}
            onUpload={() => setHasNailBedImage(true)}
            onRetake={() => setHasNailBedImage(false)}
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
            hasEyelidImage={hasEyelidImage}
            isLoading={isLoading}
            onAnalyze={handleAnalyze}
          />
        </main>
      </div>
    </div>
  );
}
