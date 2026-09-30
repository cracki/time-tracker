/**
 * API helpers — consistent JSON envelope + Persian error mapping.
 * Server errors: { error: string, code: "validation"|"forbidden"|"not_found"|"offline"|"server"|"unauthorized"|"sms_failed" }
 */

import { NextResponse } from "next/server";

export class ServerError extends Error {
  constructor(
    message: string,
    public code: "validation" | "forbidden" | "not_found" | "offline" | "server" | "unauthorized" | "sms_failed" = "server",
  ) {
    super(message);
    this.name = "ServerError";
  }
}

const STATUS_BY_CODE: Record<string, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  offline: 503,
  server: 500,
  sms_failed: 502,
};

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/** Wrap a route handler: ServerError → typed JSON, unknown → 500 (logged). */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ServerError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: STATUS_BY_CODE[e.code] ?? 500 });
    }
    console.error("[api] unexpected error:", e);
    return NextResponse.json(
      { error: "خطای غیرمنتظره در سرور رخ داد.", code: "server" },
      { status: 500 },
    );
  }
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ServerError("بدنه درخواست نامعتبر است.", "validation");
  }
}

export function requireString(v: unknown, field: string, opts: { max?: number } = {}): string {
  if (typeof v !== "string" || !v.trim()) {
    throw new ServerError(`«${field}» الزامی است.`, "validation");
  }
  const t = v.trim();
  if (opts.max && t.length > opts.max) {
    throw new ServerError(`«${field}» حداکثر ${opts.max} نویسه است.`, "validation");
  }
  return t;
}
