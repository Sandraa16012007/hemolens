"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Phone, Check, Building2 } from "lucide-react";

export default function TrendAndClinicalHelp() {
  const [contactedLab, setContactedLab] = useState<string | null>(null);

  const labs = [
    {
      id: "lab-1",
      name: "CityCare Diagnostic Centre",
      phone: "+1 (800) 555-0199",
      address: "Downtown Medical Plaza, Suite 300",
    },
    {
      id: "lab-2",
      name: "District Health Phlebotomy Lab",
      phone: "+1 (800) 555-0142",
      address: "Community Health Center, 2nd Floor",
    },
  ];

  const handleContact = (labName: string) => {
    setContactedLab(labName);
    setTimeout(() => {
      setContactedLab(null);
    }, 3500);
  };

  return (
    <div className="space-y-5">
      {/* 1. Estimated Hb Trend Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="rounded-2xl border border-border bg-white p-5 sm:p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-bold text-heading">
            Estimated Hb Trend
          </h2>
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        {/* Interactive SVG Chart Container */}
        <div className="bg-[#f8fafc]/80 rounded-xl p-4 border border-border/60 mb-4">
          <div className="relative w-full h-44">
            <svg
              viewBox="0 0 340 160"
              className="w-full h-full overflow-visible"
              aria-label="Hemoglobin level trend over past 3 months"
            >
              <defs>
                {/* Area Gradient */}
                <linearGradient id="historyAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#088395" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#088395" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines & Y-Axis Labels */}
              {/* 13.0 */}
              <line x1="38" y1="20" x2="330" y2="20" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
              <text x="14" y="23" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">13.0</text>

              {/* 12.0 Reference Baseline */}
              <line x1="38" y1="55" x2="330" y2="55" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />
              <text x="14" y="58" fill="#64748b" fontSize="10" fontWeight="600" fontFamily="sans-serif">12.0</text>
              <text x="210" y="48" fill="#64748b" fontSize="8" fontFamily="sans-serif">Clinical Reference Baseline (12.0 g/dL)</text>

              {/* 11.0 */}
              <line x1="38" y1="90" x2="330" y2="90" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
              <text x="14" y="93" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">11.0</text>

              {/* 10.0 */}
              <line x1="38" y1="125" x2="330" y2="125" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
              <text x="14" y="128" fill="#94a3b8" fontSize="10" fontFamily="sans-serif">10.0</text>

              {/* Area Under Curve */}
              {/* Points: Jun (80, 75), Aug (180, 62), Sep (280, 104) */}
              <polygon
                points="80,75 180,62 280,104 280,135 80,135"
                fill="url(#historyAreaGrad)"
              />

              {/* Trend Polyline */}
              <polyline
                points="80,75 180,62 280,104"
                fill="none"
                stroke="#088395"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Point 1: 20 Jun (11.4 g/dL) */}
              <circle cx="80" cy="75" r="4.5" fill="#ffffff" stroke="#088395" strokeWidth="2.5" />
              <text x="80" y="65" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="700" fontFamily="sans-serif">
                11.4
              </text>
              <text x="80" y="145" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="sans-serif">
                20 Jun
              </text>

              {/* Point 2: 12 Aug (11.8 g/dL) */}
              <circle cx="180" cy="62" r="4.5" fill="#ffffff" stroke="#088395" strokeWidth="2.5" />
              <text x="180" y="52" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="700" fontFamily="sans-serif">
                11.8
              </text>
              <text x="180" y="145" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="sans-serif">
                12 Aug
              </text>

              {/* Point 3: 17 Sep (10.6 g/dL - Latest / Lower) */}
              <circle cx="280" cy="104" r="5" fill="#bf191d" stroke="#ffffff" strokeWidth="2" />
              <text x="280" y="95" textAnchor="middle" fill="#bf191d" fontSize="9" fontWeight="700" fontFamily="sans-serif">
                10.6
              </text>
              <text x="280" y="145" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="600" fontFamily="sans-serif">
                17 Sep
              </text>
            </svg>
          </div>
        </div>

        {/* Note Callout */}
        <div className="rounded-xl bg-[#f8fafc] border border-border/80 p-3.5 flex items-start gap-2.5">
          <div className="w-5 h-5 rounded-md bg-red-100 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
            <TrendingDown className="w-3.5 h-3.5" />
          </div>
          <p className="text-xs text-muted leading-relaxed">
            <strong className="text-heading font-semibold">Note:</strong> Your
            latest estimate is slightly lower than August. A routine blood test
            can check your iron levels.
          </p>
        </div>
      </motion.div>

      {/* 2. Need Clinical Help? Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className="rounded-2xl border border-border bg-white p-5 sm:p-6"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <h2 className="text-base sm:text-lg font-bold text-heading">
            Need Clinical Help?
          </h2>
        </div>
        <p className="text-xs text-muted leading-relaxed mb-4">
          Quickly share this trend record with certified local medical
          laboratories or request formal phlebotomy services.
        </p>

        {/* Toast Alert when contacted */}
        <AnimatePresence>
          {contactedLab && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2"
            >
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>
                Contact request dispatched to <strong>{contactedLab}</strong>. A clinic coordinator will call you.
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Labs List */}
        <div className="space-y-2.5">
          {labs.map((lab) => (
            <div
              key={lab.id}
              className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface/80 border border-border/80 hover:border-accent/40 transition-all"
            >
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-semibold text-heading truncate">
                  {lab.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => handleContact(lab.name)}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-surface-alt border border-border text-xs font-semibold text-heading transition-colors shadow-2xs hover:border-border/90 active:scale-95"
              >
                <Phone className="w-3 h-3 text-muted" />
                <span>Contact</span>
              </button>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
