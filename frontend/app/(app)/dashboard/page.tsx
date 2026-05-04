import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, ClipboardCheck, Activity } from "lucide-react";
import { authedApi, ApiError } from "@/lib/server-api";
import type { Bidder, EvaluationSummary, Tender } from "@/lib/types";
import { VerdictDonut } from "@/components/charts/verdict-donut";

export const dynamic = "force-dynamic";

async function safeGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return await authedApi<T>(path);
  } catch (e) {
    if (e instanceof ApiError) return fallback;
    return fallback;
  }
}

export default async function DashboardPage() {
  const [tenders, bidders, evals] = await Promise.all([
    safeGet<Tender[]>("/tenders", []),
    safeGet<Bidder[]>("/bidders", []),
    safeGet<EvaluationSummary[]>("/evaluations", []),
  ]);

  const needsReview = evals.filter((e) => e.verdict === "needs_review").length;
  const done = evals.filter((e) => e.overall_confidence > 0);
  const avgConf =
    done.length > 0 ? done.reduce((a, b) => a + b.overall_confidence, 0) / done.length : null;

  const verdictCounts = ["eligible", "needs_review", "not_eligible", "approved", "pending"].map(
    (name) => ({ name, value: evals.filter((e) => e.verdict === name).length })
  );

  const KPIS = [
    { label: "Active tenders", value: tenders.length, Icon: FileText },
    { label: "Bidders ingested", value: bidders.length, Icon: Users },
    { label: "Items needing review", value: needsReview, Icon: ClipboardCheck },
    {
      label: "Avg. confidence",
      value: avgConf != null ? `${(avgConf * 100).toFixed(0)}%` : "—",
      Icon: Activity,
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1>Dashboard</h1>
        <p className="text-text-muted">Live overview of evaluations across your jurisdiction.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map(({ label, value, Icon }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-text-subtle">{label}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-text">{value}</div>
              </div>
              <div className="h-9 w-9 rounded bg-primary/10 text-primary flex items-center justify-center">
                <Icon className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Verdict distribution</CardTitle>
            <CardDescription>Eligible / needs review / not eligible / approved.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <VerdictDonut data={verdictCounts} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent evaluations</CardTitle>
            <CardDescription>Latest 5 across all tenders.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {evals.length === 0 ? (
              <span className="text-text-subtle">No activity yet.</span>
            ) : (
              <ul className="space-y-1.5">
                {evals.slice(0, 5).map((e) => (
                  <li key={e.id} className="flex justify-between text-text-muted tabular-nums">
                    <span>
                      Eval #{e.id} (bidder {e.bidder_id}) — {e.verdict}
                    </span>
                    <span className="text-xs text-text-subtle">
                      {new Date(e.created_at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
