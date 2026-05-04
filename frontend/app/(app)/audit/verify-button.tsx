"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert } from "lucide-react";

interface Result {
  ok: boolean;
  error: string | null;
}

export function VerifyButton() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/audit/verify");
      const data = (await res.json()) as Result;
      setResult(data);
    } catch {
      setResult({ ok: false, error: "Network error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <div
          className={
            "text-sm px-3 py-1.5 rounded border " +
            (result.ok
              ? "bg-success/10 border-success/30 text-success"
              : "bg-danger/10 border-danger/30 text-danger")
          }
        >
          {result.ok ? (
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Chain intact
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" />
              {result.error ?? "Chain broken"}
            </span>
          )}
        </div>
      )}
      <Button variant="outline" onClick={run} disabled={busy}>
        <ShieldCheck className="h-4 w-4" />
        {busy ? "Verifying..." : "Verify integrity"}
      </Button>
    </div>
  );
}
