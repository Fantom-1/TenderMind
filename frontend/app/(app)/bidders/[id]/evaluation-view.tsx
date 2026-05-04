"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VerdictPill } from "@/components/verdict-pill";
import { ConfidenceBars } from "@/components/confidence-bars";
import { ChevronRight, FileSearch, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Criterion, EvaluationDetail, EvidenceRow, Verdict } from "@/lib/types";

interface Joined {
  c: Criterion;
  e: EvidenceRow | null;
}

export function EvaluationView({
  detail,
  criteria,
}: {
  detail: EvaluationDetail;
  criteria: Criterion[];
}) {
  const router = useRouter();
  const evidenceById = useMemo(() => {
    const m = new Map<string, EvidenceRow>();
    for (const e of detail.evidence) m.set(e.criterion_id, e);
    return m;
  }, [detail.evidence]);

  const joined: Joined[] = useMemo(
    () => criteria.map((c) => ({ c, e: evidenceById.get(c.criterion_id) ?? null })),
    [criteria, evidenceById]
  );

  const [selectedId, setSelectedId] = useState<string | null>(joined[0]?.c.criterion_id ?? null);
  const selected = joined.find((j) => j.c.criterion_id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-text-subtle">Verdict</div>
            <div className="mt-1.5">
              <VerdictPill verdict={detail.verdict as Verdict} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-text-subtle">Overall confidence</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-text">
              {(detail.overall_confidence * 100).toFixed(0)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-text-subtle">Status</div>
            <div className="mt-1.5">
              <Pill tone={detail.status === "done" ? "success" : "muted"}>{detail.status}</Pill>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[28rem_1fr] gap-4 items-start">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Criteria</CardTitle>
            <CardDescription>Click a row to inspect its evidence.</CardDescription>
          </CardHeader>
          <div className="border-t border-border max-h-[70vh] overflow-y-auto">
            {joined.length === 0 ? (
              <div className="p-4 text-sm text-text-subtle">No criteria for this tender yet.</div>
            ) : (
              <ul>
                {joined.map(({ c, e }) => {
                  const active = c.criterion_id === selectedId;
                  const verdict = (e?.verdict ?? "pending") as Verdict;
                  return (
                    <li key={c.criterion_id}>
                      <button
                        onClick={() => setSelectedId(c.criterion_id)}
                        className={cn(
                          "w-full text-left px-4 py-2.5 border-b border-border flex items-start gap-3 transition-colors",
                          active ? "bg-primary/5" : "hover:bg-slate-50"
                        )}
                      >
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 mt-0.5 flex-none transition-transform",
                            active ? "rotate-90 text-primary" : "text-text-subtle"
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {c.mandatory && <Pill tone="danger">Mandatory</Pill>}
                            <VerdictPill verdict={verdict} />
                            {e && (
                              <span className="text-xs tabular-nums text-text-muted">
                                {(e.total * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-text mt-1 line-clamp-2">{c.description}</div>
                          <div className="text-[10px] font-mono text-text-subtle mt-0.5">
                            {c.criterion_id}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          {selected ? (
            <DetailPanels
              joined={selected}
              evaluationId={detail.id}
              onSaved={() => router.refresh()}
            />
          ) : (
            <Card>
              <CardContent className="p-6 text-sm text-text-subtle">
                Pick a criterion to see source, extraction, and confidence breakdown.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailPanels({
  joined,
  evaluationId,
  onSaved,
}: {
  joined: Joined;
  evaluationId: number;
  onSaved: () => void;
}) {
  const { c, e } = joined;
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-primary" />
            Source
          </CardTitle>
          <CardDescription>
            Bidder document, page {e?.source_page ?? "?"}. Tender clause from page {c.source_page ?? "?"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-text-subtle mb-1">Tender requirement</div>
            <blockquote className="text-sm text-text-muted bg-slate-50 border-l-2 border-primary/40 pl-3 py-2 italic">
              {c.source_text || c.description}
            </blockquote>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-primary" />
            Extraction
          </CardTitle>
          <CardDescription>What the model found in the bidder&apos;s documents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!e ? (
            <p className="text-text-subtle">
              No evidence row. Either the evaluation is still running, or this criterion was not yet processed.
            </p>
          ) : (
            <>
              <Field label="Found">
                {e.found ? <Pill tone="success">Yes</Pill> : <Pill tone="warn">Not found</Pill>}
              </Field>
              <Field label="Extracted value">
                <span className="text-text">{e.extracted_value || "—"}</span>
              </Field>
              <Field label="Threshold">
                <span className="text-text-muted tabular-nums">
                  {c.comparison ?? ""} {c.threshold ?? "—"} {c.unit ?? ""}
                </span>
              </Field>
              <Field label="Meets criterion">
                {e.meets_criterion === true ? (
                  <Pill tone="success">Yes</Pill>
                ) : e.meets_criterion === false ? (
                  <Pill tone="danger">No</Pill>
                ) : (
                  <Pill tone="muted">Unknown</Pill>
                )}
              </Field>
              <Field label="Reason">
                <span className="text-text-muted">{e.reason || "—"}</span>
              </Field>
              {e.chain_of_thought && (
                <details className="text-xs text-text-subtle">
                  <summary className="cursor-pointer hover:text-text">Model reasoning</summary>
                  <pre className="whitespace-pre-wrap font-mono mt-2 bg-slate-50 p-2 rounded text-[11px]">
                    {e.chain_of_thought}
                  </pre>
                </details>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {e && (
        <Card>
          <CardHeader>
            <CardTitle>Confidence breakdown</CardTitle>
            <CardDescription>
              Q = 0.25·Q_ocr + 0.35·Q_ext + 0.30·Q_match + 0.10·Q_doc
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConfidenceBars
              q_ocr={e.q_ocr}
              q_ext={e.q_ext}
              q_match={e.q_match}
              q_doc={e.q_doc}
              total={e.total}
            />
          </CardContent>
        </Card>
      )}

      <OverridePanel
        evaluationId={evaluationId}
        criterionId={c.criterion_id}
        currentMeets={e?.meets_criterion}
        onSaved={onSaved}
      />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-3 items-start">
      <div className="text-xs uppercase tracking-wide text-text-subtle pt-0.5">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function OverridePanel({
  evaluationId,
  criterionId,
  currentMeets,
  onSaved,
}: {
  evaluationId: number;
  criterionId: string;
  currentMeets?: boolean;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function send(newMeets: boolean | null) {
    if (reason.trim().length < 5) {
      setMsg("Reason must be at least 5 characters.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/review/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluation_id: evaluationId,
          criterion_id: criterionId,
          new_meets: newMeets,
          reason,
        }),
      });
      if (!res.ok) {
        setMsg(`Override failed (${res.status})`);
        return;
      }
      setReason("");
      setMsg("Override recorded.");
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Officer review</CardTitle>
        <CardDescription>
          Overrides are signed by your account and added to the audit chain.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="reason">Reason (required, 5+ chars)</Label>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Verified ISO certificate manually with issuing body."
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => send(true)} disabled={busy} variant="primary">
            Confirm meets
          </Button>
          <Button onClick={() => send(false)} disabled={busy} variant="danger">
            Mark fails
          </Button>
          <Button onClick={() => send(null)} disabled={busy} variant="ghost">
            Reset
          </Button>
        </div>
        {currentMeets !== undefined && (
          <p className="text-xs text-text-subtle">
            Current model decision:{" "}
            {currentMeets === true ? "meets" : currentMeets === false ? "fails" : "unknown"}.
          </p>
        )}
        {msg && <p className="text-xs text-text-muted">{msg}</p>}
      </CardContent>
    </Card>
  );
}
