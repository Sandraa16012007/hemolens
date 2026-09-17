"use client";

import { Camera, FileText, MessageSquare } from "lucide-react";
import FeatureCard from "./FeatureCard";

const features = [
  {
    icon: Camera,
    title: "Simple Photo Check",
    description:
      "Take a quick, painless picture of your lower eyelid right from your phone. No needles or lab visits needed.",
  },
  {
    icon: FileText,
    title: "Instant Screening Report",
    description:
      "Get an immediate, easy-to-read report showing your estimated hemoglobin range and personalized risk level.",
  },
  {
    icon: MessageSquare,
    title: "AI Health Guide",
    description:
      "Chat with your personal health assistant to understand your results, learn iron-rich food tips, and know when to see a doctor.",
  },
];

export default function FeaturesGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3.5" id="features-grid">
      {features.map((feature, i) => (
        <FeatureCard
          key={feature.title}
          icon={feature.icon}
          title={feature.title}
          description={feature.description}
          index={i}
        />
      ))}
    </div>
  );
}
