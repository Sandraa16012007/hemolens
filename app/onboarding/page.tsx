"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import OnboardingHeader from "./components/OnboardingHeader";
import BasicInfoCard, { BasicInfoData } from "./components/BasicInfoCard";
import HealthNutritionCard, {
  HealthNutritionData,
} from "./components/HealthNutritionCard";
import PrimaryCareCard, {
  PrimaryCareData,
} from "./components/PrimaryCareCard";
import SymptomsCard, { SymptomsData } from "./components/SymptomsCard";
import PregnancyCard, { PregnancyData } from "./components/PregnancyCard";
import LocationCard, { LocationData } from "./components/LocationCard";
import OnboardingFooter from "./components/OnboardingFooter";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { getCurrentUser, getHealthProfile, upsertHealthProfile } from "@/lib/supabase/auth";

export default function OnboardingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
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

  const [primaryCare, setPrimaryCare] = useState<PrimaryCareData>({
    doctorPhone: "",
    doctorName: "",
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check authentication & load existing profile if present
  useEffect(() => {
    async function loadUser() {
      const user = await getCurrentUser();
      if (!user) {
        // Fallback: If not logged in or in preview mode, let them continue or redirect
        return;
      }
      setUserId(user.id);
      const { data: profile } = await getHealthProfile(user.id);
      if (profile) {
        if (profile.age) setBasicInfo((prev) => ({ ...prev, age: String(profile.age) }));
        if (profile.gender) setBasicInfo((prev) => ({ ...prev, gender: profile.gender || "" }));
        if (profile.height_cm) setBasicInfo((prev) => ({ ...prev, height: String(profile.height_cm) }));
        if (profile.weight_kg) setBasicInfo((prev) => ({ ...prev, weight: String(profile.weight_kg) }));
        if (profile.dietary_pattern) setHealthNutrition((prev) => ({ ...prev, dietaryPattern: profile.dietary_pattern as any }));
        if (profile.anemia_history) setHealthNutrition((prev) => ({ ...prev, anemiaHistory: profile.anemia_history as any }));
        if (profile.chronic_conditions) setHealthNutrition((prev) => ({ ...prev, medicalConditions: profile.chronic_conditions || "" }));
        if (profile.symptoms) setSymptoms((prev) => ({ ...prev, selectedSymptoms: profile.symptoms || [] }));
        if (profile.pregnancy_status) setPregnancy({ pregnancyStatus: profile.pregnancy_status as any });
        if (profile.location) setLocation({ location: profile.location || "" });
        if (profile.doctor_name || profile.doctor_phone) {
          setPrimaryCare({
            doctorName: profile.doctor_name || "",
            doctorPhone: profile.doctor_phone || "",
          });
        }
      }
    }
    loadUser();
  }, []);

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

  const handlePrimaryCareChange = (
    field: keyof PrimaryCareData,
    value: string
  ) => {
    setPrimaryCare((prev) => ({ ...prev, [field]: value }));
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

  const handleSaveAndContinue = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      let currentUserId = userId;
      if (!currentUserId) {
        const user = await getCurrentUser();
        currentUserId = user ? user.id : null;
      }

      if (currentUserId) {
        const combinedSymptoms = [...symptoms.selectedSymptoms];
        if (symptoms.otherSymptoms.trim()) {
          combinedSymptoms.push(symptoms.otherSymptoms.trim());
        }

        const { error } = await upsertHealthProfile({
          id: currentUserId,
          age: basicInfo.age ? parseInt(basicInfo.age, 10) : null,
          gender: basicInfo.gender || null,
          height_cm: basicInfo.height ? parseFloat(basicInfo.height) : null,
          weight_kg: basicInfo.weight ? parseFloat(basicInfo.weight) : null,
          dietary_pattern: healthNutrition.dietaryPattern || null,
          anemia_history: healthNutrition.anemiaHistory || null,
          chronic_conditions: healthNutrition.medicalConditions || null,
          symptoms: combinedSymptoms,
          pregnancy_status: pregnancy.pregnancyStatus || null,
          location: location.location || null,
          doctor_name: primaryCare.doctorName || null,
          doctor_phone: primaryCare.doctorPhone || null,
        });

        if (error) {
          console.error("Profile save error:", error);
          setErrorMessage(error.message || "Failed to save profile to database.");
          setIsLoading(false);
          return;
        }
      }

      setIsLoading(false);
      setIsSaved(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 700);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err?.message || "An unexpected error occurred while saving.");
    }
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

          {/* Error Alert */}
          <AnimatePresence>
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6 mx-auto max-w-md p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center justify-center gap-2 shadow-sm"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

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
            {/* Left Column: Basic Information, Health/Nutrition & Primary Care Provider */}
            <div className="space-y-6">
              <BasicInfoCard
                data={basicInfo}
                onChange={handleBasicInfoChange}
              />
              <HealthNutritionCard
                data={healthNutrition}
                onChange={handleHealthNutritionChange}
              />
              <PrimaryCareCard
                data={primaryCare}
                onChange={handlePrimaryCareChange}
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
