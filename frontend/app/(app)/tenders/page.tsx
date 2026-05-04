import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Upload, FileText } from "lucide-react";
import { authedApi, ApiError } from "@/lib/server-api";
import { readSession } from "@/lib/auth";
import { DeleteButton } from "@/components/delete-button";
import type { Tender } from "@/lib/types";

export const dynamic = "force-dynamic";

async function fetchTenders(): Promise<{ items: Tender[]; error?: string }> {
  try {
    const items = await authedApi<Tender[]>("/tenders");
    return { items };
  } catch (e) {
    if (e instanceof ApiError) return { items: [], error: `Backend ${e.status}` };
    return { items: [], error: "Backend unreachable" };
  }
}

export default async function TendersPage() {
  const { items, error } = await fetchTenders();
  const session = readSession();
  const canDelete = session?.role === "approver" || session?.role === "auditor";
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-end justify-between">
        <div>
          <h1>Tenders</h1>
          <p className="text-text-muted">RFPs ingested into the air-gapped pipeline.</p>
        </div>
        <Link href="/tenders/new">
          <Button>
            <Upload className="h-4 w-4" />
            Upload tender
          </Button>
        </Link>
      </div>

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-warn">
            {error}. Showing empty list — start the FastAPI server on{" "}
            <code className="font-mono">:8000</code>.
          </CardContent>
        </Card>
      )}

      {items.length === 0 && !error ? (
        <Card>
          <CardHeader>
            <CardTitle>No tenders yet</CardTitle>
            <CardDescription>
              Drop a digital PDF, scanned PDF, or DOCX. OCR + criteria extraction kicks off automatically.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <table className="w-full">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Uploaded</th>
                <th className="w-px"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-text-subtle" />
                      <span className="font-medium text-text">{t.title}</span>
                    </div>
                  </td>
                  <td>
                    <Pill tone={t.status === "uploaded" ? "info" : "muted"}>{t.status}</Pill>
                  </td>
                  <td className="text-text-muted tabular-nums">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="flex items-center gap-3 justify-end">
                      <Link href={`/tenders/${t.id}`} className="text-primary hover:underline text-sm">
                        Open
                      </Link>
                      {canDelete && (
                        <DeleteButton resource="tenders" id={t.id} label={t.title} />
                      )}
                    </div>
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
