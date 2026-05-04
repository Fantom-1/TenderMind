import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const session = readSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar email={session.email} role={session.role} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
