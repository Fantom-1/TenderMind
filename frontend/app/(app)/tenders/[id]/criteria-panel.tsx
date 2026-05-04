"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Sparkles, Eye, X } from "lucide-react";
import type { Criterion } from "@/lib/types";

export function CriteriaPanel({ tenderId, initial }: { tenderId: number; initial: Criterion[] }) {
  const router = useRouter();
  const [criteria] = useState(initial);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<Criterion | null>(null);

  async function trigger() {
    setRunning(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/evaluations/extract/${tenderId}`, { method: "POST" });
      if (!res.ok) {
        setMsg(`Extraction failed (${res.status}). Is Celery running?`);
        return;
      }
      setMsg("Extraction queued. Refresh in a few seconds.");
      setTimeout(() => router.refresh(), 4000);
    } catch {
      setMsg("Network error.");
    } finally {
      setRunning(false);
    }
  }

  if (criteria.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No criteria extracted yet</CardTitle>
          <CardDescription>
            Run the extractor — Gemma reads the tender section by section and emits structured criteria with source pages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={trigger} disabled={running}>
            <Sparkles className="h-4 w-4" />
            {running ? "Queuing..." : "Extract criteria"}
          </Button>
          {msg && <p className="text-sm text-text-muted">{msg}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-4">
      <Card>
        <table className="w-full">
          <thead>
            <tr>
              <th className="w-px">M</th>
              <th>Description</th>
              <th>Comparison</th>
              <th>Threshold</th>
              <th>Page</th>
              <th className="w-px"></th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c) => (
              <tr key={c.criterion_id} className="hover:bg-slate-50">
                <td>
                  {c.mandatory ? (
                    <Pill tone="danger">M</Pill>
                  ) : (
                    <Pill tone="muted">O</Pill>
                  )}
                </td>
                <td className="max-w-xl">
                  <div className="font-medium text-text">{c.description}</div>
                  <div className="text-xs text-text-subtle font-mono mt-0.5">{c.criterion_id}</div>
                </td>
                <td className="text-text-muted">{c.comparison ?? "—"}</td>
                <td className="text-text-muted tabular-nums">
                  {c.threshold ?? "—"} {c.unit ?? ""}
                </td>
                <td className="text-text-muted tabular-nums">{c.source_page ?? "—"}</td>
                <td>
                  <button
                    onClick={() => setSelected(c)}
                    className="inline-flex items-center gap-1 text-primary text-sm hover:underline"
                  >
                    <Eye className="h-3 w-3" />
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="h-fit lg:sticky lg:top-4">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Source view</CardTitle>
            <CardDescription>
              {selected ? `Page ${selected.source_page ?? "?"} of the tender` : "Click a criterion to inspect."}
            </CardDescription>
          </div>
          {selected && (
            <button
              onClick={() => setSelected(null)}
              className="h-7 w-7 rounded hover:bg-slate-100 flex items-center justify-center"
              aria-label="Clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </CardHeader>
        <CardContent>
          {selected ? (
            <div className="space-y-3">
              <div className="text-xs uppercase tracking-wide text-text-subtle">Extracted</div>
              <div className="text-sm text-text">{selected.description}</div>
              <div className="border-t border-border pt-3">
                <div className="text-xs uppercase tracking-wide text-text-subtle mb-1.5">
                  Original clause
                </div>
                <blockquote className="text-sm text-text-muted bg-slate-50 border-l-2 border-primary/40 pl-3 py-2 italic">
                  {selected.source_text || "(no source text recorded)"}
                </blockquote>
              </div>
            </div>
          ) : (
            <div className="text-sm text-text-subtle">
              Every extracted criterion is anchored to a page + clause from the tender PDF.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
