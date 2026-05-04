import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authedApi, ApiError } from "@/lib/server-api";
import { readSession } from "@/lib/auth";
import { DeleteButton } from "@/components/delete-button";
import type { Bidder, EvaluationSummary, EvaluationDetail, Criterion } from "@/lib/types";
import { EvaluationView } from "./evaluation-view";
import { ApprovalBar } from "./approval-bar";

export const dynamic = "force-dynamic";

async function safeGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return await authedApi<T>(path);
  } catch (e) {
    if (e instanceof ApiError) return fallback;
    return fallback;
  }
}

export default async function BidderPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const allBidders = await safeGet<Bidder[]>("/bidders", []);
  const bidder = allBidders.find((b) => b.id === id);
  if (!bidder) notFound();

  const [evals, criteria] = await Promise.all([
    safeGet<EvaluationSummary[]>(`/evaluations?tender_id=${bidder.tender_id}`, []),
    safeGet<Criterion[]>(`/evaluations/criteria/${bidder.tender_id}`, []),
  ]);
  const myEvals = evals.filter((e) => e.bidder_id === id).sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1
  );
  const latest = myEvals[0];

  let detail: EvaluationDetail | null = null;
  if (latest) {
    detail = await safeGet<EvaluationDetail | null>(`/evaluations/${latest.id}`, null);
  }

  const session = readSession();
  const role = session?.role ?? "uploader";
  const canDelete = role === "approver" || role === "auditor";

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Link
            href={`/tenders/${bidder.tender_id}`}
            className="text-sm text-text-muted hover:text-text"
          >
            &larr; Back to tender
          </Link>
          <h1 className="mt-1">{bidder.name}</h1>
          <p className="text-text-muted text-sm tabular-nums">
            {bidder.n_files} file(s) &middot; uploaded {new Date(bidder.created_at).toLocaleDateString()}
          </p>
        </div>
        {canDelete && (
          <DeleteButton
            resource="bidders"
            id={bidder.id}
            label={bidder.name}
            redirectTo={`/tenders/${bidder.tender_id}`}
            size="md"
          />
        )}
      </div>

      {!detail ? (
        <Card>
          <CardHeader>
            <CardTitle>No evaluation yet</CardTitle>
            <CardDescription>
              Queue an evaluation from the tender page. Each criterion gets its own evidence row, confidence breakdown, and verdict.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/tenders/${bidder.tender_id}`}
              className="text-primary hover:underline text-sm"
            >
              Go to tender bidders tab &rarr;
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <ApprovalBar detail={detail} role={role} />
            {canDelete && (
              <DeleteButton
                resource="evaluations"
                id={detail.id}
                label={`evaluation #${detail.id}`}
              />
            )}
          </div>
          <EvaluationView detail={detail} criteria={criteria} />
        </>
      )}
    </div>
  );
}
