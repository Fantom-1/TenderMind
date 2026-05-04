"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

function crumbs(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return ["Home"];
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1));
}

export function Topbar() {
  const pathname = usePathname();
  const trail = crumbs(pathname);
  return (
    <header className="h-14 bg-surface border-b border-border flex items-center px-4 gap-3">
      <button
        aria-label="Open menu"
        className="md:hidden h-9 w-9 rounded hover:bg-slate-100 flex items-center justify-center"
      >
        <Menu className="h-4 w-4" />
      </button>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
        {trail.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className={i === trail.length - 1 ? "text-text font-medium" : "text-text-subtle"}>
              {c}
            </span>
            {i < trail.length - 1 && <span className="text-text-subtle">/</span>}
          </span>
        ))}
      </nav>
    </header>
  );
}
