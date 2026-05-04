import { cookies } from "next/headers";
import type { Role } from "./types";

export interface Session {
  token: string;
  email: string;
  role: Role;
}

const COOKIE = "tm_session";

export function readSession(): Session | null {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE;
