"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Users,
  ClipboardCheck,
  ScrollText,
  Settings,
  ShieldCheck,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/tenders", label: "Tenders", Icon: FileText },
  { href: "/bidders", label: "Bidders", Icon: Users },
  { href: "/review", label: "Review queue", Icon: ClipboardCheck },
  { href: "/audit", label: "Audit log", Icon: ScrollText },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export function Sidebar({ email, role }: { email: string; role: string }) {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col bg-surface border-r border-border">
      <div className="h-14 px-4 flex items-center gap-2 border-b border-border">
        <div className="h-8 w-8 rounded bg-primary text-primary-fg flex items-center justify-center">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-text">TenderMind AI</div>
          <div className="text-[10px] uppercase tracking-wide text-text-subtle">Air-gapped build</div>
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {NAV.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-text-muted hover:bg-slate-100 hover:text-text"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="h-8 w-8 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-semibold">
            {email.slice(0, 2).toUpperCase()}
          </div>
          <div className="leading-tight min-w-0 flex-1">
            <div className="text-xs font-medium text-text truncate">{email}</div>
            <div className="text-[10px] uppercase tracking-wide text-text-subtle">{role}</div>
          </div>
        </div>
        <form action="/api/auth/logout" method="post" className="mt-1">
          <button
            type="submit"
            className="w-full text-left text-xs text-text-muted hover:text-text px-2 py-1.5 rounded hover:bg-slate-100"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
