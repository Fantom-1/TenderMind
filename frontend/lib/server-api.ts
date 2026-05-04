// Server-only fetch wrapper. Reads the session cookie, attaches the bearer
// token, and talks to the FastAPI backend. Never importable from "use client".
import "server-only";
import { readSession } from "./auth";
import { api, ApiError } from "./api";

export { ApiError };

export async function authedApi<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const session = readSession();
  if (!session) throw new ApiError(401, null, "no_session");
  return api<T>(path, { ...init, token: session.token });
}
