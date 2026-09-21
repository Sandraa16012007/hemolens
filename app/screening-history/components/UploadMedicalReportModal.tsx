"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  UploadCloud,
  FileText,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  Calendar,
  Building2,
  Activity,
  Trash2,
} from "lucide-react";

interface UploadMedicalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UploadMedicalReportModal({
  isOpen,
  onClose,
}: UploadMedicalReportModalProps) {
  const [reportType, setReportType] = useState<
    "cbc" | "doctor_notes" | "iron_panel" | "other"
  >("cbc");
  const [reportDate, setReportDate] = useState("2026-09-15");
  const [facilityName, setFacilityName] = useState("");
  const [labHbValue, setLabHbValue] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<Array<{ name: string; size: string }>>([
    { name: "CBC_Venous_Panel_Sep2026.pdf", size: "1.4 MB" },
  ]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reportTypes = [
    { id: "cbc", label: "CBC Blood Panel" },
    { id: "doctor_notes", label: "Doctor's Notes" },
    { id: "iron_panel", label: "Ferritin / Iron Profile" },
    { id: "other", label: "Other Medical Lab" },
  ] as const;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map((f) => ({
        name: f.name,
        size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
      }));
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 2000);
    }, 1200);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-heading/60 backdrop-blur-xs"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
            className="relative w-full max-w-xl rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-2xl z-10 max-h-[92vh] overflow-y-auto flex flex-col"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 p-1.5 rounded-lg text-muted hover:text-heading hover:bg-surface transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {isSuccess ? (
              <div className="py-10 text-center space-y-3">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto"
                >
                  <CheckCircle2 className="w-8 h-8" />
                </motion.div>
                <h3 className="text-xl font-bold text-heading">
                  Medical Report Uploaded!
                </h3>
                <p className="text-xs sm:text-sm text-muted max-w-sm mx-auto">
                  Your lab results and doctor notes have been securely linked to your HemoLens clinical history.
                </p>
              </div>
            ) : (
              <div>
                {/* Header */}
                <div className="flex items-start gap-3 mb-5">
                  <div className="p-2.5 rounded-xl bg-accent/30 text-accent-dark shrink-0">
                    <FileSpreadsheet className="w-5 h-5" strokeWidth={2} />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-heading">
                      Add Medical Reports & Lab Results
                    </h2>
                    <p className="text-xs text-muted mt-0.5">
                      Upload venous blood test reports, ferritin tests, or physician clinical notes
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Report Type Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-heading mb-1.5">
                      Report Category
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {reportTypes.map((t) => {
                        const isSelected = reportType === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setReportType(t.id)}
                            className={`px-2.5 py-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                              isSelected
                                ? "border-accent-dark bg-accent/20 text-heading ring-1 ring-accent-dark/40 font-semibold"
                                : "border-border bg-white text-muted hover:text-heading hover:bg-surface"
                            }`}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Drag and Drop Zone */}
                  <div>
                    <label className="block text-xs font-semibold text-heading mb-1.5">
                      Attach Document (PDF, JPG, PNG)
                    </label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border hover:border-accent-dark rounded-xl p-5 text-center bg-surface/50 hover:bg-accent/5 cursor-pointer transition-all"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <UploadCloud className="w-8 h-8 text-accent-dark mx-auto mb-1.5" />
                      <p className="text-xs font-semibold text-heading">
                        Click to upload or drag & drop files
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">
                        Lab PDFs, EMR summaries, or clear photos (max 25MB)
                      </p>
                    </div>

                    {/* Attached files list */}
                    {files.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {files.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border text-xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <FileText className="w-4 h-4 text-accent-dark shrink-0" />
                              <span className="font-medium text-heading truncate">
                                {file.name}
                              </span>
                              <span className="text-[11px] text-muted">
                                ({file.size})
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFile(idx)}
                              className="text-muted hover:text-primary transition-colors p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Report Date */}
                    <div>
                      <label
                        htmlFor="report-date"
                        className="block text-xs font-semibold text-heading mb-1"
                      >
                        Test / Consultation Date
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                        <input
                          id="report-date"
                          type="date"
                          value={reportDate}
                          onChange={(e) => setReportDate(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border bg-white text-heading focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                      </div>
                    </div>

                    {/* Confirmed Lab Hb */}
                    <div>
                      <label
                        htmlFor="lab-hb"
                        className="block text-xs font-semibold text-heading mb-1"
                      >
                        Confirmed Hb Result <span className="text-muted font-normal">(optional)</span>
                      </label>
                      <div className="relative">
                        <Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                        <input
                          id="lab-hb"
                          type="text"
                          placeholder="e.g. 10.8 g/dL"
                          value={labHbValue}
                          onChange={(e) => setLabHbValue(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border bg-white text-heading focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Lab / Clinic Facility Name */}
                  <div>
                    <label
                      htmlFor="facility-name"
                      className="block text-xs font-semibold text-heading mb-1"
                    >
                      Diagnostic Lab or Clinic Name <span className="text-muted font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                      <input
                        id="facility-name"
                        type="text"
                        placeholder="e.g. CityCare Diagnostics or Dr. Miller Office"
                        value={facilityName}
                        onChange={(e) => setFacilityName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border bg-white text-heading focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label
                      htmlFor="report-notes"
                      className="block text-xs font-semibold text-heading mb-1"
                    >
                      Clinical Remarks & Doctor Notes <span className="text-muted font-normal">(optional)</span>
                    </label>
                    <textarea
                      id="report-notes"
                      rows={2}
                      placeholder="e.g. Prescribed 65mg elemental iron supplement daily for 30 days."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-white text-heading focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                    />
                  </div>

                  {/* Privacy Notice */}
                  <div className="flex items-start gap-2 text-[11px] text-muted rounded-xl bg-surface p-2.5 border border-border">
                    <AlertCircle className="w-4 h-4 text-accent-dark shrink-0 mt-0.5" />
                    <span>
                      Medical documents are client-encrypted and used solely to calibrate your longitudinal hemoglobin trend analysis.
                    </span>
                  </div>

                  {/* Footer Action Buttons */}
                  <div className="pt-3 border-t border-border/70 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-3.5 py-2 text-xs font-semibold text-muted hover:text-heading transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={isUploading || files.length === 0}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-dark text-white text-xs font-bold hover:bg-accent-dark/90 transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
                    >
                      {isUploading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>Save & Upload Report</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
