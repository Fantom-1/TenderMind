import { cn } from "@/lib/utils";

const PARTS = [
  { key: "q_ocr", label: "OCR quality", weight: 0.25 },
  { key: "q_ext", label: "Extraction", weight: 0.35 },
  { key: "q_match", label: "Match", weight: 0.30 },
  { key: "q_doc", label: "Doc auth", weight: 0.10 },
] as const;

function barTone(v: number) {
  if (v >= 0.85) return "bg-success";
  if (v >= 0.7) return "bg-warn";
  return "bg-danger";
}

export function ConfidenceBars({
  q_ocr,
  q_ext,
  q_match,
  q_doc,
  total,
}: {
  q_ocr: number;
  q_ext: number;
  q_match: number;
  q_doc: number;
  total: number;
}) {
  const values: Record<string, number> = { q_ocr, q_ext, q_match, q_doc };
  return (
    <div className="space-y-2.5">
      {PARTS.map((p) => {
        const v = values[p.key] ?? 0;
        return (
          <div key={p.key}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-text-muted">
                {p.label} <span className="text-text-subtle">×{p.weight}</span>
              </span>
              <span className="tabular-nums text-text">{(v * 100).toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-sm overflow-hidden">
              <div
                className={cn("h-full transition-all", barTone(v))}
                style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
      <div className="border-t border-border pt-2 flex justify-between text-sm font-medium">
        <span className="text-text-muted">Weighted total</span>
        <span className="tabular-nums text-text">{(total * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}
