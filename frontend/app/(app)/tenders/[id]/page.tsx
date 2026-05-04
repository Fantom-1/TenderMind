import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pill } from "@/components/ui/pill";
import { authedApi, ApiError } from "@/lib/server-api";
import { readSession } from "@/lib/auth";
import { DeleteButton } from "@/components/delete-button";
import type { Tender, Bidder, Criterion } from "@/lib/types";
import { CriteriaPanel } from "./criteria-panel";
import { BiddersPanel } from "./bidders-panel";

export const dynamic = "force-dynamic";

async function safeGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return await authedApi<T>(path);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return fallback;
    return fallback;
  }
}

export default async function TenderDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const [tenders, criteria, bidders] = await Promise.all([
    safeGet<Tender[]>("/tenders", []),
    safeGet<Criterion[]>(`/evaluations/criteria/${id}`, []),
    safeGet<Bidder[]>(`/bidders?tender_id=${id}`, []),
  ]);

  const tender = tenders.find((t) => t.id === id);
  if (!tender) notFound();

  const session = readSession();
  const canDelete = session?.role === "approver" || session?.role === "auditor";
  const mandatoryCount = criteria.filter((c) => c.mandatory).length;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Link href="/tenders" className="text-sm text-text-muted hover:text-text">
            &larr; All tenders
          </Link>
          <h1 className="mt-1">{tender.title}</h1>
          <div className="mt-2 flex items-center gap-2">
            <Pill tone="info">{tender.status}</Pill>
            <span className="text-xs text-text-subtle tabular-nums">
              Uploaded {new Date(tender.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
        {canDelete && (
          <DeleteButton
            resource="tenders"
            id={tender.id}
            label={tender.title}
            redirectTo="/tenders"
            size="md"
          />
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Criteria extracted" value={criteria.length} />
        <Stat label="Mandatory" value={mandatoryCount} />
        <Stat label="Bidders" value={bidders.length} />
      </div>

      <Tabs defaultValue="criteria">
        <TabsList>
          <TabsTrigger value="criteria">Criteria</TabsTrigger>
          <TabsTrigger value="bidders">Bidders</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="criteria">
          <CriteriaPanel tenderId={id} initial={criteria} />
        </TabsContent>
        <TabsContent value="bidders">
          <BiddersPanel tenderId={id} initial={bidders} canDelete={canDelete} />
        </TabsContent>
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Audit trail filtered to this tender.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-text-subtle">
              Wired in Day 3 with the audit page.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-text-subtle">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums text-text">{value}</div>
      </CardContent>
    </Card>
  );
}
