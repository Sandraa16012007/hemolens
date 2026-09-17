import { ShieldCheck } from "lucide-react";

export default function RegulatorySafeguard() {
  return (
    <footer className="pt-2 pb-6">
      <div className="rounded-2xl border border-border bg-white p-4 sm:p-5 flex items-start gap-3 shadow-xs">
        <ShieldCheck className="w-5 h-5 text-accent-dark shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs sm:text-sm font-bold text-heading mb-0.5">
            Regulatory &amp; Clinical Safeguard
          </h4>
          <p className="text-xs text-muted leading-relaxed">
            HemoLens is a preliminary screening aid and optical estimation tool, not an authorized medical diagnosis. Laboratory blood testing via venous phlebotomy is required to confirm anemia or start iron therapy.
          </p>
        </div>
      </div>
    </footer>
  );
}
