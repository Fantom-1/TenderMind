import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export async function POST(req: Request) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: "no_session" }, { status: 401 });
  const body = await req.text();
  const upstream = await fetch(`${BASE}/evaluations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.token}`,
      "Content-Type": "application/json",
    },
    body,
  });
  const out = await upstream.text();
  return new NextResponse(out, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
