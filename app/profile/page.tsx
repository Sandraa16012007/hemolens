"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Mail,
  Lock,
  Calendar,
  Save,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HeartPulse,
  Stethoscope,
  Activity,
  ShieldAlert,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import DashboardHeader from "../components/DashboardHeader";
import {
  getCurrentUser,
  getHealthProfile,
  upsertHealthProfile,
  updateUserAccount,
  deleteUserAccount,
} from "@/lib/supabase/auth";
import { useSidebar } from "../context/SidebarContext";
import type { DietaryPattern, AnemiaHistory, PregnancyStatus, BiologicalGender } from "@/types/database.types";

const SYMPTOMS_LIST = [
  { id: "fatigue", label: "Extreme Fatigue & Weakness" },
  { id: "paleness", label: "Pale Eyelids or Skin" },
  { id: "dizziness", label: "Dizziness or Lightheadedness" },
  { id: "cold_hands", label: "Cold Hands or Feet" },
  { id: "shortness_of_breath", label: "Shortness of Breath" },
  { id: "rapid_heartbeat", label: "Fast or Irregular Heartbeat" },
  { id: "headaches", label: "Frequent Headaches" },
];

export default function ProfilePage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isCollapsed } = useSidebar();
  const [userId, setUserId] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Account State
  const [email, setEmail] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [fullName, setFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Health Profile State
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<BiologicalGender | "">("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [dietaryPattern, setDietaryPattern] = useState<DietaryPattern | "">("Non-veg");
  const [anemiaHistory, setAnemiaHistory] = useState<AnemiaHistory | "">("No");
  const [pregnancyStatus, setPregnancyStatus] = useState<PregnancyStatus | "">("Not applicable");
  const [chronicConditions, setChronicConditions] = useState("");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [doctorPhone, setDoctorPhone] = useState("");

  // Feedback State
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Danger Zone / Delete Dialog State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.push("/");
          return;
        }

        setUserId(user.id);
        setEmail(user.email || "");
        if (user.created_at) {
          setCreatedAt(new Date(user.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }));
        }
        if (user.user_metadata?.full_name) {
          setFullName(user.user_metadata.full_name);
        }

        const { data: profile } = await getHealthProfile(user.id);
        if (profile) {
          if (profile.age) setAge(String(profile.age));
          if (profile.gender) setGender(profile.gender as BiologicalGender);
          if (profile.height_cm) setHeight(String(profile.height_cm));
          if (profile.weight_kg) setWeight(String(profile.weight_kg));
          if (profile.dietary_pattern) setDietaryPattern(profile.dietary_pattern as DietaryPattern);
          if (profile.anemia_history) setAnemiaHistory(profile.anemia_history as AnemiaHistory);
          if (profile.pregnancy_status) setPregnancyStatus(profile.pregnancy_status as PregnancyStatus);
          if (profile.chronic_conditions) setChronicConditions(profile.chronic_conditions);
          if (profile.symptoms) setSelectedSymptoms(profile.symptoms);
          if (profile.location) setLocation(profile.location);
          if (profile.doctor_name) setDoctorName(profile.doctor_name);
          if (profile.doctor_phone) setDoctorPhone(profile.doctor_phone);
        }
      } catch (err: unknown) {
        console.error("Failed to load user profile:", err);
      } finally {
        setIsInitialLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  const toggleSymptom = (symptomId: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptomId)
        ? prev.filter((id) => id !== symptomId)
        : [...prev, symptomId]
    );
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // 1. Update Auth user metadata / password if modified
      if (fullName || newPassword) {
        const { error: authError } = await updateUserAccount({
          fullName: fullName.trim() || undefined,
          password: newPassword.trim() || undefined,
        });

        if (authError) {
          throw new Error(authError.message);
        }
        if (newPassword) {
          setNewPassword("");
        }
      }

      // 2. Upsert health profile in database
      const { error: profileError } = await upsertHealthProfile({
        id: userId,
        age: age ? parseInt(age, 10) : null,
        gender: gender || null,
        height_cm: height ? parseFloat(height) : null,
        weight_kg: weight ? parseFloat(weight) : null,
        dietary_pattern: dietaryPattern || null,
        anemia_history: anemiaHistory || null,
        pregnancy_status: pregnancyStatus || null,
        chronic_conditions: chronicConditions.trim() || null,
        symptoms: selectedSymptoms,
        location: location.trim() || null,
        doctor_name: doctorName.trim() || null,
        doctor_phone: doctorPhone.trim() || null,
      });

      if (profileError) {
        throw new Error(profileError.message);
      }

      setSuccessMessage("Your profile and health details have been saved successfully.");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update profile details.";
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!userId || deleteConfirmText.trim().toLowerCase() !== "delete") return;

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const { error } = await deleteUserAccount(userId);
      if (error) {
        throw new Error(error.message);
      }

      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete account.";
      setErrorMessage(msg);
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col lg:flex-row" id="profile-page">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          isCollapsed ? "lg:pl-20" : "lg:pl-64"
        }`}
      >
        <DashboardHeader
          breadcrumb={{
            backLabel: "Dashboard",
            backHref: "/dashboard",
            title: "User Profile & Settings",
          }}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-border shadow-xs">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xl shadow-xs ring-4 ring-slate-100">
                {fullName ? fullName.charAt(0).toUpperCase() : email.charAt(0).toUpperCase() || "U"}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-heading tracking-tight">
                  {fullName || "User Account"}
                </h1>
                <p className="text-xs sm:text-sm text-muted flex items-center gap-2 mt-0.5">
                  <Mail className="w-3.5 h-3.5" />
                  <span>{email || "Loading..."}</span>
                  {createdAt && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Member since {createdAt}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Feedback alerts */}
          <AnimatePresence>
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </motion.div>
            )}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {isInitialLoading ? (
            <div className="bg-white rounded-2xl border border-border p-12 flex flex-col items-center justify-center gap-3 text-muted">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm font-medium">Loading user profile details...</p>
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* Section 1: Account Information */}
              <div className="bg-white rounded-2xl border border-border p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-border">
                  <User className="w-5 h-5 text-primary" />
                  <div>
                    <h2 className="text-base font-bold text-heading">Account Credentials</h2>
                    <p className="text-xs text-muted">Update your display name and login password</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-heading mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Jane Doe"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-heading mb-1.5">
                      Email Address <span className="text-xs text-muted font-normal">(Read-only)</span>
                    </label>
                    <input
                      type="email"
                      disabled
                      value={email}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface text-muted text-sm cursor-not-allowed"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-heading mb-1.5">
                      Change Password <span className="text-xs text-muted font-normal">(Leave blank to keep current)</span>
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password (min. 8 characters)"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Health & Biometric Data */}
              <div className="bg-white rounded-2xl border border-border p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-border">
                  <HeartPulse className="w-5 h-5 text-accent-dark" />
                  <div>
                    <h2 className="text-base font-bold text-heading">Health & Biometrics</h2>
                    <p className="text-xs text-muted">Calibrates preliminary hemoglobin estimations</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-heading mb-1.5">
                      Age (Years)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="e.g. 28"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-heading mb-1.5">
                      Biological Gender
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as BiologicalGender)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm text-heading bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    >
                      <option value="">Select gender</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-heading mb-1.5">
                      Height (cm)
                    </label>
                    <input
                      type="number"
                      min="50"
                      max="250"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      placeholder="e.g. 165"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-heading mb-1.5">
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="300"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="e.g. 58"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-heading mb-1.5">
                      Dietary Pattern
                    </label>
                    <select
                      value={dietaryPattern}
                      onChange={(e) => setDietaryPattern(e.target.value as DietaryPattern)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm text-heading bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    >
                      <option value="Non-veg">Non-vegetarian</option>
                      <option value="Vegetarian">Vegetarian</option>
                      <option value="Vegan">Vegan</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-heading mb-1.5">
                      Personal Anemia History
                    </label>
                    <select
                      value={anemiaHistory}
                      onChange={(e) => setAnemiaHistory(e.target.value as AnemiaHistory)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm text-heading bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    >
                      <option value="No">No prior history</option>
                      <option value="Yes">Yes, previously diagnosed</option>
                      <option value="Not sure">Not sure / Unknown</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-heading mb-1.5">
                      Pregnancy Status
                    </label>
                    <select
                      value={pregnancyStatus}
                      onChange={(e) => setPregnancyStatus(e.target.value as PregnancyStatus)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm text-heading bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    >
                      <option value="Not applicable">Not applicable</option>
                      <option value="Pregnant">Currently Pregnant</option>
                      <option value="Not pregnant">Not pregnant</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-heading mb-1.5">
                    Chronic Medical Conditions / Medications
                  </label>
                  <input
                    type="text"
                    value={chronicConditions}
                    onChange={(e) => setChronicConditions(e.target.value)}
                    placeholder="e.g. Thalassemia trait, Kidney disease, Iron supplements"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
              </div>

              {/* Section 3: Symptoms Check */}
              <div className="bg-white rounded-2xl border border-border p-5 sm:p-6 shadow-xs space-y-3">
                <div className="flex items-center gap-2.5 pb-2 border-b border-border">
                  <Activity className="w-5 h-5 text-accent-dark" />
                  <div>
                    <h2 className="text-base font-bold text-heading">Known Symptoms</h2>
                    <p className="text-xs text-muted">Select symptoms you regularly experience</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {SYMPTOMS_LIST.map((symptom) => {
                    const isSelected = selectedSymptoms.includes(symptom.id);
                    return (
                      <button
                        key={symptom.id}
                        type="button"
                        onClick={() => toggleSymptom(symptom.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-primary/10 border-primary text-primary font-semibold shadow-xs"
                            : "bg-surface border-border text-muted hover:text-heading hover:border-slate-300"
                        }`}
                      >
                        {symptom.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 4: Primary Care & Location */}
              <div className="bg-white rounded-2xl border border-border p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-border">
                  <Stethoscope className="w-5 h-5 text-accent-dark" />
                  <div>
                    <h2 className="text-base font-bold text-heading">Care Provider & Location</h2>
                    <p className="text-xs text-muted">Optional clinic information for sharing screening reports</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-heading mb-1.5">
                      Location / Region
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. New Delhi, India"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-heading mb-1.5">
                      Doctor / Clinic Name
                    </label>
                    <input
                      type="text"
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                      placeholder="e.g. Dr. Priya Sharma"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-heading mb-1.5">
                      Doctor Phone / Contact
                    </label>
                    <input
                      type="tel"
                      value={doctorPhone}
                      onChange={(e) => setDoctorPhone(e.target.value)}
                      placeholder="e.g. +91 98765 43210"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm flex items-center gap-2 hover:bg-primary-dark transition-all shadow-xs disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Section 5: Danger Zone (Delete Account) */}
          <div className="bg-white rounded-2xl border border-red-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-red-100">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              <div>
                <h2 className="text-base font-bold text-red-700">Danger Zone</h2>
                <p className="text-xs text-muted">Irreversible actions regarding your account and health data</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-red-50/60 border border-red-200/80">
              <div>
                <h3 className="text-sm font-bold text-heading">Delete Account & Health Profile</h3>
                <p className="text-xs text-muted mt-0.5 max-w-lg">
                  Permanently remove all your saved profile information, clinical metadata, and log out your session.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-border shadow-xl max-w-md w-full p-6 space-y-4"
            >
              <div className="flex items-center gap-3 text-red-600">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-heading">Confirm Account Deletion</h3>
                  <p className="text-xs text-muted">This action is permanent and cannot be undone.</p>
                </div>
              </div>

              <p className="text-xs text-muted leading-relaxed">
                To confirm deletion of your profile and data, please type <strong className="text-heading font-semibold">delete</strong> in the box below:
              </p>

              <input
                type="text"
                placeholder="Type 'delete' to confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
              />

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmText("");
                  }}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-heading hover:bg-surface transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || deleteConfirmText.trim().toLowerCase() !== "delete"}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirm Delete</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
