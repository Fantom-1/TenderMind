import { NextResponse } from "next/server";
import { api, ApiError } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/auth";
import type { LoginResponse } from "@/lib/types";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "missing_credentials" }, { status: 400 });
  }
  try {
    const data = await api<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const res = NextResponse.json({ email: data.email, role: data.role });
    res.cookies.set(SESSION_COOKIE, JSON.stringify({
      token: data.access_token,
      email: data.email,
      role: data.role,
    }), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return res;
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: e.status });
    }
    return NextResponse.json({ error: "upstream_unreachable" }, { status: 502 });
  }
}
