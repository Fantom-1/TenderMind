import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "success" | "danger" | "warn" | "muted" | "info";

const tones: Record<Tone, string> = {
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
  warn: "bg-warn/10 text-warn",
  muted: "bg-slate-100 text-text-muted",
  info: "bg-primary/10 text-primary",
};

export function Pill({
  tone = "muted",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium",
        tones[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
