import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { ClipboardCheck } from "lucide-react";
import { authedApi, ApiError } from "@/lib/server-api";
import type { Bidder, ReviewQueueRow, Tender } from "@/lib/types";

export const dynamic = "force-dynamic";

async function safeGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return await authedApi<T>(path);
  } catch (e) {
    if (e instanceof ApiError) return fallback;
    return fallback;
  }
}

function age(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))}m`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default async function ReviewPage() {
  const [queue, tenders, bidders] = await Promise.all([
    safeGet<ReviewQueueRow[]>("/review/queue", []),
    safeGet<Tender[]>("/tenders", []),
    safeGet<Bidder[]>("/bidders", []),
  ]);
  const tenderTitle = new Map(tenders.map((t) => [t.id, t.title]));
  const bidderName = new Map(bidders.map((b) => [b.id, b.name]));

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1>Review queue</h1>
        <p className="text-text-muted">
          Items the model marked <span className="text-warn font-medium">needs review</span> — sorted oldest first.
        </p>
      </div>

      {queue.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-success" />
              Inbox empty
            </CardTitle>
            <CardDescription>
              Anything below the confidence threshold for a mandatory criterion lands here for an officer override.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <table className="w-full">
            <thead>
              <tr>
                <th>Eval</th>
                <th>Tender</th>
                <th>Bidder</th>
                <th>Confidence</th>
                <th>Waiting</th>
                <th className="w-px"></th>
              </tr>
            </thead>
            <tbody>
              {queue.map((r) => {
                const conf = (r.overall_confidence * 100).toFixed(0);
                const tone =
                  r.overall_confidence >= 0.7 ? "warn" : "danger";
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="font-mono text-text-muted">#{r.id}</td>
                    <td className="text-text-muted">
                      <Link
                        href={`/tenders/${r.tender_id}`}
                        className="hover:underline"
                      >
                        {tenderTitle.get(r.tender_id) ?? `Tender #${r.tender_id}`}
                      </Link>
                    </td>
                    <td className="font-medium text-text">
                      {bidderName.get(r.bidder_id) ?? `Bidder #${r.bidder_id}`}
                    </td>
                    <td>
                      <Pill tone={tone}>{conf}%</Pill>
                    </td>
                    <td className="text-text-muted tabular-nums">{age(r.updated_at)}</td>
                    <td>
                      <Link
                        href={`/bidders/${r.bidder_id}`}
                        className="text-primary hover:underline text-sm"
                      >
                        Review &rarr;
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
