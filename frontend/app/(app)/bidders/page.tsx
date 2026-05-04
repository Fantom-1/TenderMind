import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authedApi, ApiError } from "@/lib/server-api";
import type { Bidder, Tender } from "@/lib/types";

export const dynamic = "force-dynamic";

async function safeGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return await authedApi<T>(path);
  } catch (e) {
    if (e instanceof ApiError) return fallback;
    return fallback;
  }
}

export default async function BiddersPage() {
  const [bidders, tenders] = await Promise.all([
    safeGet<Bidder[]>("/bidders", []),
    safeGet<Tender[]>("/tenders", []),
  ]);
  const tenderTitle = new Map(tenders.map((t) => [t.id, t.title]));

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1>Bidders</h1>
        <p className="text-text-muted">All bidder submissions across tenders.</p>
      </div>
      {bidders.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No bidders yet</CardTitle>
            <CardDescription>Open a tender and add bidders from the Bidders tab.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <table className="w-full">
            <thead>
              <tr>
                <th>Bidder</th>
                <th>Tender</th>
                <th>Files</th>
                <th>Uploaded</th>
                <th className="w-px"></th>
              </tr>
            </thead>
            <tbody>
              {bidders.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="font-medium text-text">{b.name}</td>
                  <td className="text-text-muted">
                    <Link href={`/tenders/${b.tender_id}`} className="hover:underline">
                      {tenderTitle.get(b.tender_id) ?? `Tender #${b.tender_id}`}
                    </Link>
                  </td>
                  <td className="text-text-muted tabular-nums">{b.n_files}</td>
                  <td className="text-text-muted tabular-nums">
                    {new Date(b.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <Link href={`/bidders/${b.id}`} className="text-primary hover:underline text-sm">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
