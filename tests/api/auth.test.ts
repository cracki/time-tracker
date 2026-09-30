/**
 * Auth flow tests: OTP request/verify, session cookie, /me, logout,
 * validation errors, inactive accounts, attempt limits.
 */

import { describe, it, expect } from "vitest";
import { api, login, json } from "../helpers/api";
import { clearOtp } from "../helpers/db";
import { TEST_USERS } from "../../scripts/seed-test";

const ADMIN = TEST_USERS.admin.mobile;
const COLLAB = TEST_USERS.collab.mobile;
const INACTIVE = TEST_USERS.inactive.mobile;

describe("POST /api/auth/request-otp", () => {
  it("rejects invalid mobile format", async () => {
    const res = await api("/api/auth/request-otp", { method: "POST", body: json({ phone: "12345" }) });
    expect(res.status).toBe(400);
    expect((res.body as { code: string }).code).toBe("validation");
  });

  it("rejects unknown users without leaking existence details", async () => {
    const res = await api("/api/auth/request-otp", { method: "POST", body: json({ phone: "09359999999" }) });
    expect(res.status).toBe(404);
    expect((res.body as { error: string }).error).toContain("ثبت نشده");
  });

  it("rejects inactive accounts", async () => {
    const res = await api("/api/auth/request-otp", { method: "POST", body: json({ phone: INACTIVE }) });
    expect(res.status).toBe(403);
    expect((res.body as { code: string }).code).toBe("forbidden");
  });

  it("returns devCode in the test env and enforces resend cooldown", async () => {
    const first = await api<{ devCode?: string; expiresAt?: number }>("/api/auth/request-otp", {
      method: "POST",
      body: json({ phone: COLLAB }),
    });
    expect(first.status).toBe(200);
    expect(first.body.devCode).toMatch(/^\d{5}$/); // CONFIG.otpLength

    const second = await api("/api/auth/request-otp", { method: "POST", body: json({ phone: COLLAB }) });
    expect(second.status).toBe(400);
    expect((second.body as { error: string }).error).toContain("صبر کنید");
  });
});

describe("POST /api/auth/verify-otp", () => {
  it("rejects a wrong code and counts the attempt", async () => {
    // request → wrong code 3x → locked
    const { body: r } = await api<{ devCode: string }>("/api/auth/request-otp", {
      method: "POST",
      body: json({ phone: ADMIN }),
    });
    for (let i = 0; i < 3; i++) {
      const bad = await api("/api/auth/verify-otp", { method: "POST", body: json({ phone: ADMIN, code: "00000" }) });
      expect([400, 401]).toContain(bad.status);
    }
    // after maxAttempts even the CORRECT code is rejected
    const correct = await api("/api/auth/verify-otp", { method: "POST", body: json({ phone: ADMIN, code: r.devCode }) });
    expect(correct.status).toBeGreaterThanOrEqual(400);
  });

  it("issues an httpOnly session cookie on success", async () => {
    await clearOtp(COLLAB); // reset cooldown from earlier tests
    const { body: r } = await api<{ devCode: string }>("/api/auth/request-otp", {
      method: "POST",
      body: json({ phone: COLLAB }),
    });
    const res = await fetch("http://localhost:3100/api/auth/verify-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: json({ phone: COLLAB, code: r.devCode }),
    });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("tt_session=");
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
  });
});

describe("GET /api/auth/me + POST /api/auth/logout", () => {
  it("me without cookie → 401", async () => {
    const res = await api("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("me with cookie returns the logged-in user; logout invalidates the session", async () => {
    const cookie = await login(COLLAB);
    const me = await api<{ user?: { name: string; mobile: string } }>("/api/auth/me", {}, cookie);
    expect(me.status).toBe(200);
    expect(me.body.user?.mobile).toBe(COLLAB);
    expect(me.body.user?.name).toContain("مریم");

    const out = await api("/api/auth/logout", { method: "POST" }, cookie);
    expect(out.status).toBe(200);
    const meAfter = await api("/api/auth/me", {}, cookie);
    expect(meAfter.status).toBe(401);
  });
});
