import { AlertCircle } from "lucide-react";

export default function Footer() {
  return (
    <footer
      className="mt-3.5 rounded-lg border border-border bg-accent/20 px-3.5 py-2.5 flex items-start gap-2.5"
      id="regulatory-footer"
      style={{ borderLeft: "3.5px solid #0d9488" }}
    >
      <AlertCircle className="w-4 h-4 text-accent-dark mt-0.5 shrink-0" />
      <p className="text-[11px] sm:text-xs text-muted leading-relaxed">
        <span className="font-semibold text-accent-dark">
          Regulatory Notice:
        </span>{" "}
        Preliminary screening aid only. Does not diagnose anemia or replace
        clinical laboratory complete blood count (CBC) testing or physician
        evaluation.
      </p>
    </footer>
  );
}
