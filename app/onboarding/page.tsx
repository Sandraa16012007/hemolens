"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import OnboardingHeader from "./components/OnboardingHeader";
import BasicInfoCard, { BasicInfoData } from "./components/BasicInfoCard";
import HealthNutritionCard, {
  HealthNutritionData,
} from "./components/HealthNutritionCard";
import SymptomsCard, { SymptomsData } from "./components/SymptomsCard";
import PregnancyCard, { PregnancyData } from "./components/PregnancyCard";
import LocationCard, { LocationData } from "./components/LocationCard";
import OnboardingFooter from "./components/OnboardingFooter";
import { CheckCircle2 } from "lucide-react";

export default function OnboardingPage() {
  const [basicInfo, setBasicInfo] = useState<BasicInfoData>({
    age: "28",
    gender: "",
    height: "165",
    weight: "58",
  });

  const [healthNutrition, setHealthNutrition] = useState<HealthNutritionData>({
    dietaryPattern: "Non-veg",
    anemiaHistory: "No",
    medicalConditions: "",
    isNoneConditions: false,
  });

  const [symptoms, setSymptoms] = useState<SymptomsData>({
    selectedSymptoms: ["no_symptoms"],
    otherSymptoms: "",
  });

  const [pregnancy, setPregnancy] = useState<PregnancyData>({
    pregnancyStatus: "Not applicable",
  });

  const [location, setLocation] = useState<LocationData>({
    location: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleBasicInfoChange = (
    field: keyof BasicInfoData,
    value: string
  ) => {
    setBasicInfo((prev) => ({ ...prev, [field]: value }));
  };

  const handleHealthNutritionChange = <K extends keyof HealthNutritionData>(
    field: K,
    value: HealthNutritionData[K]
  ) => {
    setHealthNutrition((prev) => ({ ...prev, [field]: value }));
  };

  const handleSymptomsChange = <K extends keyof SymptomsData>(
    field: K,
    value: SymptomsData[K]
  ) => {
    setSymptoms((prev) => ({ ...prev, [field]: value }));
  };

  const handlePregnancyChange = (
    value: PregnancyData["pregnancyStatus"]
  ) => {
    setPregnancy({ pregnancyStatus: value });
  };

  const handleLocationChange = (value: string) => {
    setLocation({ location: value });
  };

  const handleSaveAndContinue = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between" id="onboarding-page">
      <div>
        <OnboardingHeader />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
          {/* Header Title Section */}
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
            {/* Top Indicator Pill */}
            <div className="w-8 h-1 rounded-full bg-accent-dark/30 mx-auto mb-4" />

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-heading tracking-tight mb-3">
              Tell us about yourself
            </h1>
            <p className="text-sm text-muted leading-relaxed">
              Please share your basic health details so we can accurately
              estimate your hemoglobin levels and tailor your screening report.
            </p>
          </div>

          {/* Toast Notification */}
          <AnimatePresence>
            {isSaved && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6 mx-auto max-w-md p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-center gap-2 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Health profile details saved successfully!</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Two-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left Column: Basic Information & Health/Nutrition */}
            <div className="space-y-6">
              <BasicInfoCard
                data={basicInfo}
                onChange={handleBasicInfoChange}
              />
              <HealthNutritionCard
                data={healthNutrition}
                onChange={handleHealthNutritionChange}
              />
            </div>

            {/* Right Column: Symptoms, Pregnancy & Location */}
            <div className="space-y-6">
              <SymptomsCard
                data={symptoms}
                onChange={handleSymptomsChange}
              />
              <PregnancyCard
                data={pregnancy}
                onChange={handlePregnancyChange}
              />
              <LocationCard
                data={location}
                onChange={handleLocationChange}
              />
            </div>
          </div>
        </main>
      </div>

      <OnboardingFooter
        onSubmit={handleSaveAndContinue}
        isLoading={isLoading}
      />
    </div>
  );
}
