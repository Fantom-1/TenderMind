"use client";

import * as React from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";
import type { ConfidenceBreakdown } from "@/lib/types";

function tone(value: number): { cls: string; label: string } {
  if (value >= 0.85) return { cls: "bg-success/10 text-success border-success/30", label: "High" };
  if (value >= 0.7) return { cls: "bg-warn/10 text-warn border-warn/30", label: "Medium" };
  return { cls: "bg-danger/10 text-danger border-danger/30", label: "Low" };
}

export function ConfidenceBadge({
  breakdown,
  className,
}: {
  breakdown: ConfidenceBreakdown;
  className?: string;
}) {
  const t = tone(breakdown.total);
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border text-xs font-medium tabular-nums cursor-help",
              t.cls,
              className
            )}
          >
            {(breakdown.total * 100).toFixed(0)}%
            <span className="text-[10px] opacity-70">{t.label}</span>
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={6}
            className="rounded bg-text text-white text-xs px-3 py-2 shadow-lg z-50 space-y-1 tabular-nums"
          >
            <Row k="OCR quality" v={breakdown.q_ocr} weight={0.25} />
            <Row k="Extraction" v={breakdown.q_ext} weight={0.35} />
            <Row k="Match" v={breakdown.q_match} weight={0.30} />
            <Row k="Doc auth" v={breakdown.q_doc} weight={0.10} />
            <div className="border-t border-white/20 pt-1 mt-1 flex justify-between gap-4">
              <span className="opacity-80">Weighted total</span>
              <span className="font-semibold">{(breakdown.total * 100).toFixed(0)}%</span>
            </div>
            <Tooltip.Arrow className="fill-text" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

function Row({ k, v, weight }: { k: string; v: number; weight: number }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="opacity-80">
        {k} <span className="opacity-50">×{weight}</span>
      </span>
      <span>{(v * 100).toFixed(0)}%</span>
    </div>
  );
}
