"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { CheckCircle2, FileSignature, Download, Lock } from "lucide-react";
import type { EvaluationDetail, Role } from "@/lib/types";

export function ApprovalBar({
  detail,
  role,
}: {
  detail: EvaluationDetail;
  role: Role;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const isApproved = detail.verdict === "approved" || !!detail.signed_pdf_path;
  const canApprove = role === "approver";
  const canDownload =
    role === "approver" || role === "auditor" || role === "evaluator";

  async function approve() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/reports/approve/${detail.id}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detailMsg =
          body.detail === "evaluation_not_ready"
            ? "Evaluation is not done yet."
            : body.detail ?? `Approval failed (${res.status})`;
        setMsg(detailMsg);
        return;
      }
      setMsg("Approved and signed.");
      router.refresh();
    } catch {
      setMsg("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-4">
      <CardContent className="p-4 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          {isApproved ? (
            <Pill tone="success">
              <CheckCircle2 className="h-3 w-3" />
              Approved &amp; signed
            </Pill>
          ) : (
            <Pill tone="muted">
              <Lock className="h-3 w-3" />
              Awaiting approver
            </Pill>
          )}
          <span className="text-xs text-text-subtle">
            Eval #{detail.id} &middot; status {detail.status}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {msg && <span className="text-xs text-text-muted">{msg}</span>}
          {!isApproved && canApprove && (
            <Button onClick={approve} disabled={busy || detail.status !== "done"}>
              <FileSignature className="h-4 w-4" />
              {busy ? "Signing..." : "Approve &amp; sign PDF"}
            </Button>
          )}
          {isApproved && canDownload && (
            <a href={`/api/reports/download/${detail.id}`} download>
              <Button variant="outline">
                <Download className="h-4 w-4" />
                Download signed PDF
              </Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
