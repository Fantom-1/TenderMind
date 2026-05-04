import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = readSession();
  if (!session) return NextResponse.json({ error: "no_session" }, { status: 401 });
  const upstream = await fetch(`${BASE}/reports/download/${params.id}`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  if (!upstream.ok) {
    const text = await upstream.text();
    return new NextResponse(text, { status: upstream.status });
  }
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/pdf",
      "content-disposition":
        upstream.headers.get("content-disposition") ??
        `attachment; filename="evaluation_${params.id}.pdf"`,
    },
  });
}
