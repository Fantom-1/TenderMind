import { Pill } from "@/components/ui/pill";
import type { Verdict } from "@/lib/types";
import { CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";

const map: Record<Verdict, { tone: "success" | "danger" | "warn" | "muted"; label: string; Icon: typeof CheckCircle2 }> = {
  eligible: { tone: "success", label: "Eligible", Icon: CheckCircle2 },
  not_eligible: { tone: "danger", label: "Not eligible", Icon: XCircle },
  needs_review: { tone: "warn", label: "Needs review", Icon: AlertTriangle },
  approved: { tone: "success", label: "Approved", Icon: CheckCircle2 },
  pending: { tone: "muted", label: "Pending", Icon: Clock },
};

export function VerdictPill({ verdict }: { verdict: Verdict }) {
  const cfg = map[verdict] ?? map.pending;
  const { Icon } = cfg;
  return (
    <Pill tone={cfg.tone}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Pill>
  );
}
