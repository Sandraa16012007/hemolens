"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  index: number;
}

export default function FeatureCard({
  icon: Icon,
  title,
  description,
  index,
}: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      whileHover={{ y: -3, boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}
      className="group rounded-xl border border-border bg-white p-3.5 sm:p-4 transition-colors"
      id={`feature-card-${index}`}
    >
      <div className="mb-2.5 inline-flex rounded-lg bg-accent/30 p-2">
        <Icon className="w-4 h-4 text-accent-dark" strokeWidth={1.8} />
      </div>
      <h3 className="text-xs sm:text-[13px] font-semibold text-heading mb-1">{title}</h3>
      <p className="text-[11px] sm:text-xs text-muted leading-relaxed">{description}</p>
    </motion.div>
  );
}
