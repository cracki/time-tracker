/**
 * Black-box API test helpers — real HTTP against the test server on :3100.
 * Login flows use the devCode path (SMS disabled in the test env).
 */

import { API_BASE } from "./provision";
import { clearOtp } from "./db";

export interface ApiResult<T = unknown> {
  status: number;
  body: T;
  setCookie?: string;
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
  cookie?: string,
): Promise<ApiResult<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return {
    status: res.status,
    body: body as T,
    setCookie: res.headers.get("set-cookie")?.split(";")[0],
  };
}

/** Full OTP login → returns the session cookie for subsequent calls.
 * Clears any prior OTP session first so cooldown/attempts never leak
 * between tests. */
export async function login(phone: string): Promise<string> {
  await clearOtp(phone);
  const req = await api<{ devCode?: string }>(`/api/auth/request-otp`, {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
  if (req.status !== 200 || !req.body?.devCode) {
    throw new Error(`request-otp failed (${req.status}): ${JSON.stringify(req.body)}`);
  }
  const verify = await api(`/api/auth/verify-otp`, {
    method: "POST",
    body: JSON.stringify({ phone, code: req.body.devCode }),
  });
  if (verify.status !== 200 || !verify.setCookie) {
    throw new Error(`verify-otp failed (${verify.status}): ${JSON.stringify(verify.body)}`);
  }
  return verify.setCookie;
}

export const json = (body: unknown): string => JSON.stringify(body);
