import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";

export default function RootPage() {
  const session = readSession();
  redirect(session ? "/dashboard" : "/login");
}
