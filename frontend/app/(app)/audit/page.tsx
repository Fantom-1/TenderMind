import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { authedApi, ApiError } from "@/lib/server-api";
import type { AuditEvent } from "@/lib/types";
import { VerifyButton } from "./verify-button";

export const dynamic = "force-dynamic";

async function safeGet<T>(path: string, fallback: T): Promise<T> {
  try {
    return await authedApi<T>(path);
  } catch (e) {
    if (e instanceof ApiError) return fallback;
    return fallback;
  }
}

function shortHash(h: string | null): string {
  if (!h) return "—";
  return h.slice(0, 10) + "…";
}

export default async function AuditPage() {
  const events = await safeGet<AuditEvent[]>("/audit?limit=200", []);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1>Audit log</h1>
          <p className="text-text-muted">Append-only, hash-chained record of every action.</p>
        </div>
        <VerifyButton />
      </div>

      {events.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No events yet</CardTitle>
            <CardDescription>
              Each row links to the previous via SHA-256. Postgres rules block UPDATE and DELETE.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <table className="w-full">
            <thead>
              <tr>
                <th className="w-px">#</th>
                <th>Event</th>
                <th>Actor</th>
                <th>Payload</th>
                <th>Prev hash</th>
                <th>This hash</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50 align-top">
                  <td className="font-mono text-text-subtle tabular-nums">{e.id}</td>
                  <td>
                    <Pill tone={toneFor(e.event_type)}>{e.event_type}</Pill>
                  </td>
                  <td className="text-text-muted tabular-nums">
                    {e.actor_id ?? "—"}
                  </td>
                  <td className="font-mono text-[11px] text-text-muted max-w-md truncate">
                    {JSON.stringify(e.payload)}
                  </td>
                  <td className="font-mono text-[11px] text-text-subtle">{shortHash(e.prev_hash)}</td>
                  <td className="font-mono text-[11px] text-text-subtle">{shortHash(e.this_hash)}</td>
                  <td className="text-text-muted tabular-nums whitespace-nowrap">
                    {new Date(e.ts).toLocaleString()}
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

function toneFor(eventType: string): "success" | "warn" | "danger" | "info" | "muted" {
  if (eventType.startsWith("evaluation.approved")) return "success";
  if (eventType.startsWith("review.override")) return "warn";
  if (eventType.endsWith(".failed")) return "danger";
  if (eventType.startsWith("tender.") || eventType.startsWith("bidder.")) return "info";
  return "muted";
}
