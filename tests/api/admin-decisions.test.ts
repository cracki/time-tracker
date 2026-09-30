/** Admin decision tests (approve / adjust / reject) + dashboards reflect state. */

import { describe, it, expect, beforeAll } from "vitest";
import { api, login, json } from "../helpers/api";
import db from "../helpers/db";
import { TEST_USERS } from "../../scripts/seed-test";
import { tehranTodayIso, tehranDaysAgoIso } from "../../src/lib/server/rules";

let adminCookie = "";
let collabCookie = "";

beforeAll(async () => {
  [adminCookie, collabCookie] = await Promise.all([
    login(TEST_USERS.admin.mobile),
    login(TEST_USERS.collab.mobile),
  ]);
});

interface LogShape {
  log?: { id: string; status: string; approvedDurationMinutes: number | null; adminNote: string | null; rejectionReason: string | null; approvedByName: string | null };
  items?: { id: string; status: string }[];
  error?: string;
}

async function createCollabLog(description: string, minutes = 60): Promise<string> {
  const res = await api<LogShape>("/api/logs", {
    method: "POST",
    body: json({ workDate: tehranTodayIso(), description, durationMinutes: minutes }),
  }, collabCookie);
  expect(res.status).toBe(201);
  return res.body.log!.id;
}

describe("POST /api/admin/logs/[id]/decision", () => {
  it("collaborators cannot call decisions", async () => {
    const id = await createCollabLog("تصمیم غیرمجاز");
    const res = await api(`/api/admin/logs/${id}/decision`, {
      method: "POST",
      body: json({ action: "approve" }),
    }, collabCookie);
    expect(res.status).toBe(403);
  });

  it("approve: sets status + approver", async () => {
    const id = await createCollabLog("برای تأیید");
    const res = await api<LogShape>(`/api/admin/logs/${id}/decision`, {
      method: "POST",
      body: json({ action: "approve" }),
    }, adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.log?.status).toBe("approved");
    expect(res.body.log?.approvedDurationMinutes).toBe(60);
    expect(res.body.log?.approvedByName).toContain("سعید");
  });

  it("adjust: stores approvedDurationMinutes + adminNote", async () => {
    const id = await createCollabLog("برای اصلاح", 90);
    const res = await api<LogShape>(`/api/admin/logs/${id}/decision`, {
      method: "POST",
      body: json({ action: "adjust", minutes: 120, note: "۳۰ دقیقه اضافه‌کاری" }),
    }, adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.log?.status).toBe("adjusted");
    expect(res.body.log?.approvedDurationMinutes).toBe(120);
    expect(res.body.log?.adminNote).toContain("اضافه‌کاری");
  });

  it("adjust requires a valid positive duration", async () => {
    const id = await createCollabLog("اصلاح نامعتبر");
    const res = await api(`/api/admin/logs/${id}/decision`, {
      method: "POST",
      body: json({ action: "adjust", minutes: 0 }),
    }, adminCookie);
    expect(res.status).toBe(400);
  });

  it("reject: stores the given reason; reason is optional", async () => {
    const id = await createCollabLog("برای رد");
    const ok = await api<LogShape>(`/api/admin/logs/${id}/decision`, {
      method: "POST",
      body: json({ action: "reject", reason: "تکراری است" }),
    }, adminCookie);
    expect(ok.status).toBe(200);
    expect(ok.body.log?.status).toBe("rejected");
    expect(ok.body.log?.rejectionReason).toContain("تکراری");

    // without a reason the API still rejects (reason optional by contract)
    const id2 = await createCollabLog("رد بدون دلیل");
    const noReason = await api<LogShape>(`/api/admin/logs/${id2}/decision`, {
      method: "POST",
      body: json({ action: "reject" }),
    }, adminCookie);
    expect(noReason.status).toBe(200);
    expect(noReason.body.log?.status).toBe("rejected");
  });

  it("invalid action / already-decided log is rejected", async () => {
    const id = await createCollabLog("اکشن نامعتبر");
    const bad = await api(`/api/admin/logs/${id}/decision`, {
      method: "POST",
      body: json({ action: "delete" }),
    }, adminCookie);
    expect(bad.status).toBe(400);

    await api(`/api/admin/logs/${id}/decision`, { method: "POST", body: json({ action: "approve" }) }, adminCookie);
    const again = await api(`/api/admin/logs/${id}/decision`, {
      method: "POST",
      body: json({ action: "approve" }),
    }, adminCookie);
    expect(again.status).toBe(403); // pending-only guard
  });
});

describe("dashboards reflect decisions", () => {
  it("admin dashboard returns flat KPI summary", async () => {
    const res = await api<{ totalLogged?: number; pendingCount?: number; pendingMinutes?: number }>("/api/admin/dashboard", {}, adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.totalLogged).toBeGreaterThan(0);
    expect(typeof res.body.pendingCount).toBe("number");
    expect(typeof res.body.pendingMinutes).toBe("number");
  });

  it("collab dashboard returns today/week/month stats", async () => {
    const res = await api<{ todayLogged?: number; weekLogged?: number; monthLogged?: number }>("/api/collab/dashboard", {}, collabCookie);
    expect(res.status).toBe(200);
    expect(typeof res.body.todayLogged).toBe("number");
    expect(typeof res.body.weekLogged).toBe("number");
    expect(typeof res.body.monthLogged).toBe("number");
  });

  it("collab stats endpoint requires a range and serves with one", async () => {
    const missing = await api("/api/collab/stats", {}, collabCookie);
    expect(missing.status).toBe(400);

    const from = tehranDaysAgoIso(7);
    const ok = await api(`/api/collab/stats?from=${from}&to=${tehranTodayIso()}`, {}, collabCookie);
    expect(ok.status).toBe(200);
  });

  it("admin logs list filters by status=pending", async () => {
    const res = await api<{ items: { status: string }[]; total: number }>("/api/admin/logs?status=pending&pageSize=100", {}, adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.items.every((l) => l.status === "pending")).toBe(true);
  });
});

describe("collab cleanliness", () => {
  it("removes decision-test logs created today", async () => {
    const collab = await db.user.findUnique({ where: { mobile: TEST_USERS.collab.mobile } });
    await db.timeLog.deleteMany({ where: { userId: collab!.id, workDate: tehranTodayIso(), description: { contains: "برای " } } });
    await db.timeLog.deleteMany({ where: { userId: collab!.id, workDate: tehranTodayIso(), description: { contains: "تصمیم" } } });
    await db.timeLog.deleteMany({ where: { userId: collab!.id, workDate: tehranTodayIso(), description: { contains: "اصلاح نامعتبر" } } });
    await db.timeLog.deleteMany({ where: { userId: collab!.id, workDate: tehranTodayIso(), description: { contains: "اکشن نامعتبر" } } });
    expect(true).toBe(true);
  });
});
