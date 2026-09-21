"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Stethoscope,
  Send,
  CheckCircle2,
  Phone,
  ShieldCheck,
  FileText,
  Copy,
  Check,
} from "lucide-react";

interface ShareToPcpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareToPcpModal({
  isOpen,
  onClose,
}: ShareToPcpModalProps) {
  const [providerPhone, setProviderPhone] = useState("+1 (555) 234-5678");
  const [providerName, setProviderName] = useState("Dr. Jane Miller (Primary Care)");
  const [shareMethod, setShareMethod] = useState<"sms" | "email">("sms");
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setIsSent(true);
      setTimeout(() => {
        setIsSent(false);
        onClose();
      }, 2200);
    }, 1200);
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(
        `${window.location.origin}/screening-report?shared=pcp`
      );
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
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

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
            className="relative w-full max-w-lg rounded-2xl border border-border bg-white p-6 shadow-2xl z-10 overflow-hidden"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 p-1.5 rounded-lg text-muted hover:text-heading hover:bg-surface transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {isSent ? (
              <div className="py-8 text-center space-y-3">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto"
                >
                  <CheckCircle2 className="w-8 h-8" />
                </motion.div>
                <h3 className="text-xl font-bold text-heading">
                  Report Shared Successfully!
                </h3>
                <p className="text-xs sm:text-sm text-muted max-w-xs mx-auto">
                  A secure clinical summary link has been dispatched to{" "}
                  <span className="font-semibold text-heading">
                    {providerName}
                  </span>{" "}
                  ({providerPhone}).
                </p>
              </div>
            ) : (
              <div>
                {/* Modal Header */}
                <div className="flex items-start gap-3 mb-5">
                  <div className="p-2.5 rounded-xl bg-accent/30 text-accent-dark shrink-0">
                    <Stethoscope className="w-6 h-6" strokeWidth={2} />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-heading">
                      Share Report with PCP
                    </h2>
                    <p className="text-xs text-muted mt-0.5">
                      Transmit your screening metrics and captured scans directly to your family doctor
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSend} className="space-y-4">
                  {/* Doctor Info Card */}
                  <div className="p-3.5 rounded-xl bg-surface border border-border/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-heading">
                        Primary Care Provider
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-accent/20 text-accent-dark">
                        Onboarding Profile
                      </span>
                    </div>

                    <div className="space-y-2">
                      <input
                        type="text"
                        value={providerName}
                        onChange={(e) => setProviderName(e.target.value)}
                        placeholder="Doctor or Clinic Name"
                        className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-border bg-white text-heading focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      />

                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                        <input
                          type="tel"
                          value={providerPhone}
                          onChange={(e) => setProviderPhone(e.target.value)}
                          placeholder="Provider Phone Number"
                          required
                          className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border bg-white text-heading focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Summary of what will be transmitted */}
                  <div className="p-3 rounded-xl border border-border bg-surface/50 text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-heading">
                      <FileText className="w-3.5 h-3.5 text-accent-dark" />
                      <span>Included Clinical Package:</span>
                    </div>
                    <ul className="text-muted text-[11px] list-disc list-inside space-y-0.5 pl-1">
                      <li>Estimated Hb: <strong>10.2–11.0 g/dL</strong> (Moderate Risk)</li>
                      <li>High-resolution Palpebral Conjunctiva & Nail-bed Scans</li>
                      <li>Symptom profile and self-reported nutrition factors</li>
                    </ul>
                  </div>

                  {/* Privacy Badge */}
                  <div className="flex items-start gap-2 text-[11px] text-muted">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      Data is encrypted in transit and shared exclusively under patient-initiated consent.
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-border/70 flex items-center justify-end gap-3">

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-3.5 py-2 text-xs font-semibold text-muted hover:text-heading transition-colors"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={isSending}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-dark text-white text-xs font-bold hover:bg-accent-dark/90 transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
                      >
                        {isSending ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Dispatching...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Send to PCP</span>
                          </>
                        )}
                      </button>
                    </div>
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
