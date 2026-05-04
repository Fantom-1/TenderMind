"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  resource: "tenders" | "bidders" | "evaluations";
  id: number;
  label?: string;
  redirectTo?: string;
  size?: "sm" | "md";
}

export function DeleteButton({ resource, id, label, redirectTo, size = "sm" }: Props) {

  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    const what = label ?? `${resource.slice(0, -1)} #${id}`;
    if (!confirm(`Permanently delete ${what} and all linked records, files, and indexes?\n\nThis cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/${resource}/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 403) {
          setError("Only approver or auditor can delete.");
        } else {
          setError(body.detail || `Delete failed (${res.status})`);
        }
        setBusy(false);
        return;
      }
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error.");
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <Button
        variant="danger"
        size={size}
        onClick={onDelete}
        disabled={busy}
        type="button"
      >
        <Trash2 className="h-4 w-4 mr-1" />
        {busy ? "Deleting..." : "Delete"}
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
