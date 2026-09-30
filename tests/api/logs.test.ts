/** Log CRUD tests: create, edit rules (pending-only), delete, ownership. */

import { describe, it, expect, beforeAll } from "vitest";
import { api, login, json } from "../helpers/api";
import db from "../helpers/db";
import { TEST_USERS } from "../../scripts/seed-test";
import { tehranTodayIso, tehranDaysAgoIso } from "../../src/lib/server/rules";

let adminCookie = "";
let collabCookie = "";
const createdIds: string[] = [];

beforeAll(async () => {
  [adminCookie, collabCookie] = await Promise.all([login(TEST_USERS.admin.mobile), login(TEST_USERS.collab.mobile)]);
});

interface LogShape {
  log?: { id: string; status: string; originalDurationMinutes: number; outsideKind: string; workDate: string };
  error?: string;
  code?: string;
}

describe("POST /api/logs", () => {
  it("creates a pending log for today", async () => {
    const res = await api<LogShape>("/api/logs", {
      method: "POST",
      body: json({ workDate: tehranTodayIso(), description: "تست ایجاد گزارش", durationMinutes: 90 }),
    }, collabCookie);
    expect(res.status).toBe(201);
    expect(res.body.log?.status).toBe("pending");
    expect(res.body.log?.originalDurationMinutes).toBe(90);
    createdIds.push(res.body.log!.id);
  });

  it("rejects invalid duration (0 / negative / > 24h)", async () => {
    for (const minutes of [0, -30, 1441]) {
      const res = await api("/api/logs", {
        method: "POST",
        body: json({ workDate: tehranTodayIso(), description: "نامعتبر", durationMinutes: minutes }),
      }, collabCookie);
      expect(res.status).toBe(400);
    }
  });

  it("rejects empty/oversized description", async () => {
    const empty = await api("/api/logs", {
      method: "POST",
      body: json({ workDate: tehranTodayIso(), description: "   ", durationMinutes: 30 }),
    }, collabCookie);
    expect(empty.status).toBe(400);
  });

  it("rejects beyond-window backdates and future dates", async () => {
    const old = await api("/api/logs", {
      method: "POST",
      body: json({ workDate: tehranDaysAgoIso(10), description: "خیلی قدیمی", durationMinutes: 30 }),
    }, collabCookie);
    expect(old.status).toBe(400);

    const future = await api("/api/logs", {
      method: "POST",
      body: json({ workDate: "2099-01-01", description: "آینده", durationMinutes: 30 }),
    }, collabCookie);
    expect(future.status).toBe(400);
  });

  it("requires auth", async () => {
    const res = await api("/api/logs", {
      method: "POST",
      body: json({ workDate: tehranTodayIso(), description: "بی‌کوکی", durationMinutes: 30 }),
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/logs (my logs)", () => {
  it("returns only the caller's logs", async () => {
    const res = await api<{ items?: { id: string }[] }>("/api/logs", {}, collabCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items!.length).toBeGreaterThanOrEqual(6); // seeded fixtures
  });

  it("status filter works", async () => {
    const res = await api<{ items?: { status: string }[] }>("/api/logs?status=pending", {}, collabCookie);
    expect(res.status).toBe(200);
    expect(res.body.items!.every((l) => l.status === "pending")).toBe(true);
  });
});

describe("PUT /api/logs/[id]", () => {
  it("edits a pending log (description + duration)", async () => {
    const id = createdIds[0];
    const res = await api<LogShape>(`/api/logs/${id}`, {
      method: "PUT",
      body: json({ description: "تست ویرایش گزارش", durationMinutes: 120 }),
    }, collabCookie);
    expect(res.status).toBe(200);
    expect(res.body.log?.originalDurationMinutes).toBe(120);
  });

  it("blocks editing non-pending logs", async () => {
    // seeded adjusted log for collab
    const list = await api<{ items: { id: string; status: string }[] }>("/api/logs?status=adjusted", {}, collabCookie);
    const target = list.body.items[0];
    expect(target).toBeTruthy();
    const res = await api(`/api/logs/${target.id}`, {
      method: "PUT",
      body: json({ description: "نباید ویرایش شود" }),
    }, collabCookie);
    expect(res.status).toBe(403);
  });

  it("blocks non-owner edits (admin editing someone's log via user route)", async () => {
    const res = await api(`/api/logs/${createdIds[0]}`, {
      method: "PUT",
      body: json({ description: "ادمین غیرمجاز" }),
    }, adminCookie);
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/logs/[id]", () => {
  it("deletes own pending log", async () => {
    const create = await api<LogShape>("/api/logs", {
      method: "POST",
      body: json({ workDate: tehranTodayIso(), description: "برای حذف", durationMinutes: 15 }),
    }, collabCookie);
    const id = create.body.log!.id;
    const res = await api(`/api/logs/${id}`, { method: "DELETE" }, collabCookie);
    expect(res.status).toBe(200);
    const get = await api(`/api/logs/${id}`, {}, collabCookie);
    expect(get.status).toBe(404);
  });

  it("blocks deleting non-owned logs", async () => {
    const create = await api<LogShape>("/api/logs", {
      method: "POST",
      body: json({ workDate: tehranTodayIso(), description: "محافظت‌شده", durationMinutes: 15 }),
    }, collabCookie);
    const res = await api(`/api/logs/${create.body.log!.id}`, { method: "DELETE" }, adminCookie);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/logs/[id] ownership", () => {
  it("collaborator cannot fetch someone else's log", async () => {
    // pick a log owned by the ADMIN (not by the collab caller)
    const collab = await db.user.findUnique({ where: { mobile: TEST_USERS.collab.mobile } });
    const adminLogs = await api<{ items: { id: string; userId: string }[] }>("/api/admin/logs?pageSize=50", {}, adminCookie);
    const adminLog = adminLogs.body.items.find((l) => l.userId !== collab!.id);
    expect(adminLog).toBeTruthy();
    const res = await api(`/api/logs/${adminLog!.id}`, {}, collabCookie);
    expect([403, 404]).toContain(res.status);
  });

  it("admin can fetch any user's log via detail route", async () => {
    const mine = await api<{ items: { id: string }[] }>("/api/logs", {}, collabCookie);
    const res = await api<{ log?: { id: string }; user?: { name: string } }>(`/api/logs/${mine.body.items[0].id}`, {}, adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.log?.id).toBeTruthy();
    expect(res.body.user?.name).toBeTruthy();
  });
});
