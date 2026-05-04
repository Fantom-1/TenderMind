"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";

export default function UploadTenderPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim()) {
      setError("Title and file are both required.");
      return;
    }
    setError(null);
    setBusy(true);
    const fd = new FormData();
    fd.append("title", title);
    fd.append("file", file);
    try {
      const res = await fetch("/api/tenders/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.detail ?? body.error ?? `Upload failed (${res.status})`);
        return;
      }
      const data = await res.json();
      router.push(`/tenders/${data.id}`);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1>Upload tender</h1>
        <p className="text-text-muted">
          PDF or DOCX, up to the size limit set in <code>.env</code>. The file is hashed and stored under a UUID name.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tender document</CardTitle>
          <CardDescription>OCR + criteria extraction starts automatically once it lands.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="CRPF Vehicle Procurement RFP 2025-Q3"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="file">File</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.docx,.doc"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
              {file && (
                <p className="text-xs text-text-subtle tabular-nums">
                  {file.name} &middot; {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>
            {error && (
              <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded px-3 py-2">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                <Upload className="h-4 w-4" />
                {busy ? "Uploading..." : "Upload"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
