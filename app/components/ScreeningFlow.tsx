"use client";

import { motion } from "framer-motion";
import { Camera, FileText, MessageSquare } from "lucide-react";

const steps = [
  {
    icon: Camera,
    label: "Quick Picture",
    sublabel: "Lower eyelid photo capture",
    color: "#0d9488",
  },
  {
    icon: FileText,
    label: "Smart Screening Report",
    sublabel: "Hemoglobin range & risk level",
    color: "#bf191d",
  },
  {
    icon: MessageSquare,
    label: "AI Health Assistant",
    sublabel: "Personalized wellness guidance",
    color: "#6366f1",
  },
];

function StepAnimation({ step, index }: { step: (typeof steps)[0]; index: number }) {
  const Icon = step.icon;

  return (
    <motion.div
      className="flex flex-col items-center text-center flex-1 min-w-0"
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: 0.15 + index * 0.12 }}
    >
      {/* Animated icon container */}
      <motion.div
        className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center mb-2"
        style={{ backgroundColor: `${step.color}12` }}
        animate={{
          y: [0, -4, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          delay: index * 0.6,
          ease: "easeInOut",
        }}
      >
        <Icon
          className="w-5 h-5 sm:w-6 sm:h-6"
          style={{ color: step.color }}
          strokeWidth={1.75}
        />
        {/* Pulse ring */}
        <motion.div
          className="absolute inset-0 rounded-xl border-2"
          style={{ borderColor: step.color }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0, 0.3] }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            delay: index * 0.4,
          }}
        />
        {/* Step number badge */}
        <div
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center shadow-xs"
          style={{ backgroundColor: step.color }}
        >
          {index + 1}
        </div>
      </motion.div>

      <p className="text-xs sm:text-[13px] font-semibold text-heading leading-tight">
        {step.label}
      </p>
      <p className="text-[10px] sm:text-[11px] text-muted mt-0.5">{step.sublabel}</p>
    </motion.div>
  );
}

function ConnectorArrow() {
  return (
    <div className="hidden sm:flex items-center justify-center pt-1">
      <motion.div
        className="flex items-center gap-0.5"
        initial={{ opacity: 0, scaleX: 0 }}
        whileInView={{ opacity: 1, scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <div className="w-6 md:w-10 h-px bg-border" />
        <div className="w-0 h-0 border-t-[3.5px] border-t-transparent border-b-[3.5px] border-b-transparent border-l-[5px] border-l-border" />
      </motion.div>
    </div>
  );
}

export default function ScreeningFlow() {
  return (
    <motion.div
      className="rounded-xl border border-border bg-white overflow-hidden mb-3.5 shadow-xs"
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      id="screening-flow"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface/50">
        <span className="text-[11px] font-bold tracking-wider uppercase text-heading">
          Screening Procedure Architecture
        </span>
      </div>

      {/* Steps */}
      <div className="px-4 py-4 sm:py-5 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-2">
        {steps.map((step, i) => (
          <div key={step.label} className="contents">
            <StepAnimation step={step} index={i} />
            {i < steps.length - 1 && <ConnectorArrow />}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
