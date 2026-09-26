import { ShieldCheck } from "lucide-react";
import { useLanguage } from "@/app/context/LanguageContext";

export default function ChatDisclaimer() {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-center gap-1.5 text-xs text-muted text-center pt-2 pb-1">
      <ShieldCheck className="w-3.5 h-3.5 text-accent-dark shrink-0" />
      <span>
        {t("assistant.disclaimer", "HemoLens is for health guidance only and does not replace professional medical advice.")}
      </span>
    </div>
  );
}
