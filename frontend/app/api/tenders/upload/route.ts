import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export async function POST(req: Request) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: "no_session" }, { status: 401 });

  const form = await req.formData();
  const upstream = await fetch(`${BASE}/tenders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.token}` },
    body: form,
  });
  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
