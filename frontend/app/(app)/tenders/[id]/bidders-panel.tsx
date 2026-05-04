"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Play, Users } from "lucide-react";
import type { Bidder } from "@/lib/types";
import { DeleteButton } from "@/components/delete-button";

export function BiddersPanel({
  tenderId,
  initial,
  canDelete = false,
}: {
  tenderId: number;
  initial: Bidder[];
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [bidders] = useState(initial);
  const [name, setName] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [busy, setBusy] = useState(false);
  const [evalBusy, setEvalBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  }

  async function uploadBidder(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !files || files.length === 0) {
      setMsg("Bidder name and at least one file are required.");
      return;
    }
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.append("tender_id", String(tenderId));
    fd.append("name", name);
    Array.from(files).forEach((f) => fd.append("files", f));
    try {
      const res = await fetch("/api/bidders/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setMsg(body.detail ?? `Upload failed (${res.status})`);
        return;
      }
      setName("");
      setFiles(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function runEvaluation() {
    if (picked.size === 0) return;
    setEvalBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/evaluations/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tender_id: tenderId, bidder_ids: Array.from(picked) }),
      });
      if (!res.ok) {
        setMsg(`Evaluation failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setMsg(`Queued ${data.jobs?.length ?? 0} job(s). Track progress on each bidder page.`);
    } finally {
      setEvalBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Bidders ({bidders.length})</CardTitle>
            <CardDescription>Select bidders, then queue their evaluations.</CardDescription>
          </div>
          {bidders.length > 0 && (
            <Button onClick={runEvaluation} disabled={picked.size === 0 || evalBusy} variant="accent">
              <Play className="h-4 w-4" />
              {evalBusy ? "Queuing..." : `Run evaluation (${picked.size})`}
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {bidders.length === 0 ? (
            <div className="p-6 text-sm text-text-subtle flex items-center gap-2">
              <Users className="h-4 w-4" /> No bidders uploaded for this tender yet.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="w-px"></th>
                  <th>Bidder</th>
                  <th>Files</th>
                  <th>Uploaded</th>
                  <th className="w-px"></th>
                </tr>
              </thead>
              <tbody>
                {bidders.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td>
                      <input
                        type="checkbox"
                        checked={picked.has(b.id)}
                        onChange={() => toggle(b.id)}
                        className="h-4 w-4 accent-primary"
                      />
                    </td>
                    <td className="font-medium text-text">{b.name}</td>
                    <td className="text-text-muted tabular-nums">{b.n_files}</td>
                    <td className="text-text-muted tabular-nums">
                      {new Date(b.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex items-center gap-3 justify-end">
                        <Link
                          href={`/bidders/${b.id}`}
                          className="text-primary hover:underline text-sm"
                        >
                          Open
                        </Link>
                        {canDelete && (
                          <DeleteButton resource="bidders" id={b.id} label={b.name} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {msg && (
            <div className="p-4 text-sm text-text-muted border-t border-border">{msg}</div>
          )}
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Add a bidder</CardTitle>
          <CardDescription>Multiple files per bidder are supported.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={uploadBidder} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bname">Bidder name</Label>
              <Input id="bname" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bfiles">Documents</Label>
              <Input
                id="bfiles"
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.tif,.tiff"
                onChange={(e) => setFiles(e.target.files)}
                required
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              <Upload className="h-4 w-4" />
              {busy ? "Uploading..." : "Upload bidder"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
