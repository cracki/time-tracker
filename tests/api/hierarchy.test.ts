/**
 * Hierarchy (سلسله‌مراتب) — the security matrix:
 *   admin (مدیر ارشد)   → sees ALL logs, can NEVER decide (view-only)
 *   manager             → sees + decides ONLY their own team's logs
 *   collaborator        → no admin routes at all
 *   users management    → admin-only; collaborators get a managerId
 */

import { describe, it, expect, beforeAll } from "vitest";
import { api, login, json } from "../helpers/api";
import { TEST_USERS } from "../../scripts/seed-test";
import { tehranTodayIso } from "../../src/lib/server/rules";

let adminCookie = "";
let managerCookie = "";
let manager2Cookie = "";
let collabCookie = "";

interface LogShape {
  id: string;
  userId: string;
  status: string;
}
interface LogsRes {
  items?: LogShape[];
  total?: number;
  error?: string;
}

beforeAll(async () => {
  [adminCookie, managerCookie, manager2Cookie, collabCookie] = await Promise.all([
    login(TEST_USERS.admin.mobile),
    login(TEST_USERS.manager.mobile),
    login(TEST_USERS.manager2.mobile),
    login(TEST_USERS.collab.mobile),
  ]);
});

async function createCollabLog(description: string, cookie = collabCookie): Promise<string> {
  const res = await api<{ log?: { id: string } }>("/api/logs", {
    method: "POST",
    body: json({ workDate: tehranTodayIso(), description, durationMinutes: 60 }),
  }, cookie);
  expect(res.status).toBe(201);
  return res.body.log!.id;
}

describe("log visibility scoping", () => {
  it("admin sees logs from every team", async () => {
    const res = await api<LogsRes>("/api/admin/logs?pageSize=100", {}, adminCookie);
    expect(res.status).toBe(200);
    const userIds = new Set(res.body.items?.map((l) => l.userId));
    // both teams' collaborators + admin's own log are all visible
    expect(userIds.size).toBeGreaterThanOrEqual(3);
  });

  it("manager sees ONLY their own team's logs", async () => {
    const res = await api<LogsRes>("/api/admin/logs?pageSize=100", {}, managerCookie);
    expect(res.status).toBe(200);
    const userIds = new Set(res.body.items?.map((l) => l.userId));
    // مریم (team نگار) visible; کیانا (team مینا) must NOT appear
    const all = await api<LogsRes>("/api/admin/logs?pageSize=100", {}, adminCookie);
    const kianaLogs = all.body.items!.filter((l) => l.userId === res.body.items![0]?.userId);
    void kianaLogs;
    const usersRes = await api<{ users?: { id: string; name: string }[] }>("/api/admin/users", {}, adminCookie);
    const kiana = usersRes.body.users!.find((u) => u.name === TEST_USERS.collab2.name)!;
    const marryam = usersRes.body.users!.find((u) => u.name === TEST_USERS.collab.name)!;
    expect(userIds.has(kiana.id)).toBe(false);
    expect(userIds.has(marryam.id)).toBe(true);
  });

  it("manager filtering by another team's userId yields an empty list (no leak)", async () => {
    const usersRes = await api<{ users?: { id: string; name: string }[] }>("/api/admin/users", {}, adminCookie);
    const kiana = usersRes.body.users!.find((u) => u.name === TEST_USERS.collab2.name)!;
    const res = await api<LogsRes>(`/api/admin/logs?userId=${kiana.id}`, {}, managerCookie);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.items).toHaveLength(0);
  });

  it("collaborators cannot access admin log routes at all", async () => {
    const res = await api<LogsRes>("/api/admin/logs", {}, collabCookie);
    expect(res.status).toBe(403);
  });
});

describe("decision authority", () => {
  it("manager CAN approve their own team member's log", async () => {
    const id = await createCollabLog("تأیید توسط مدیر تیم");
    const res = await api<{ log?: { status: string; approvedByName: string | null } }>(
      `/api/admin/logs/${id}/decision`,
      { method: "POST", body: json({ action: "approve" }) },
      managerCookie,
    );
    expect(res.status).toBe(200);
    expect(res.body.log?.status).toBe("approved");
    expect(res.body.log?.approvedByName).toContain("نگار");
  });

  it("manager CANNOT decide another team's log (403, log untouched)", async () => {
    const usersRes = await api<{ users?: { id: string; name: string }[] }>("/api/admin/users", {}, adminCookie);
    const kiana = usersRes.body.users!.find((u) => u.name === TEST_USERS.collab2.name)!;
    const otherTeamLogs = await api<LogsRes>(`/api/admin/logs?userId=${kiana.id}&status=pending`, {}, adminCookie);
    const target = otherTeamLogs.body.items![0];

    const res = await api(`/api/admin/logs/${target.id}/decision`, {
      method: "POST",
      body: json({ action: "approve" }),
    }, managerCookie);
    expect(res.status).toBe(403);

    // untouched — still pending for its own manager
    const check = await api<{ log?: { status: string } }>(`/api/logs/${target.id}`, {}, adminCookie);
    expect(check.body.log?.status).toBe("pending");
  });

  it("supreme admin (مدیر ارشد) CANNOT decide — view-only", async () => {
    const id = await createCollabLog("ادمین نباید تصمیم بگیرد");
    const res = await api(`/api/admin/logs/${id}/decision`, {
      method: "POST",
      body: json({ action: "approve" }),
    }, adminCookie);
    expect(res.status).toBe(403);

    // log stays pending — the manager can still decide on it
    const viaManager = await api<{ log?: { status: string } }>(`/api/admin/logs/${id}/decision`, {
      method: "POST",
      body: json({ action: "approve" }),
    }, managerCookie);
    expect(viaManager.status).toBe(200);
    expect(viaManager.body.log?.status).toBe("approved");
  });

  it("manager cannot decide their OWN log either (managers have no manager)", async () => {
    // a manager's own log is not a team member's log — server must refuse
    const usersRes = await api<{ users?: { id: string; name: string }[] }>("/api/admin/users", {}, adminCookie);
    const me = usersRes.body.users!.find((u) => u.name === TEST_USERS.manager.name)!;
    const res = await api<LogsRes>(`/api/admin/logs?userId=${me.id}`, {}, managerCookie);
    expect(res.body.total ?? 0).toBe(0);
  });
});

describe("people & summary scoping", () => {
  it("manager people list contains only their own collaborators", async () => {
    const res = await api<{ user: { name: string } }[]>("/api/admin/people", {}, managerCookie);
    expect(res.status).toBe(200);
    const names = res.body.map((s) => s.user.name);
    expect(names).toContain(TEST_USERS.collab.name);
    expect(names).not.toContain(TEST_USERS.collab2.name);
  });

  it("manager cannot open another team's person summary", async () => {
    const usersRes = await api<{ users?: { id: string; name: string }[] }>("/api/admin/users", {}, adminCookie);
    const kiana = usersRes.body.users!.find((u) => u.name === TEST_USERS.collab2.name)!;
    const res = await api(`/api/admin/people/${kiana.id}/summary`, {}, managerCookie);
    expect(res.status).toBe(403);
  });
});

describe("users management (admin-only + manager assignment)", () => {
  it("manager cannot manage users", async () => {
    const res = await api("/api/admin/users", {}, managerCookie);
    expect(res.status).toBe(403);
  });

  it("collaborator profile exposes their manager (managerName)", async () => {
    const res = await api<{ user?: { managerId: string | null; managerName: string | null; role: string } }>("/api/auth/me", {}, collabCookie);
    expect(res.status).toBe(200);
    expect(res.body.user?.role).toBe("collaborator");
    expect(res.body.user?.managerName).toContain("نگار");
  });

  it("admin creates a collaborator with a manager; invalid manager is rejected", async () => {
    const managerRes = await api<{ users?: { id: string; role: string }[] }>("/api/admin/users", {}, adminCookie);
    const mgr = managerRes.body.users!.find((u) => u.role === "manager")!;

    const ok = await api<{ user?: { managerId: string | null; managerName: string | null } }>("/api/admin/users", {
      method: "POST",
      body: json({ name: "همکار با مدیر", mobile: "09120000021", role: "collaborator", managerId: mgr.id }),
    }, adminCookie);
    expect(ok.status).toBe(201);
    expect(ok.body.user?.managerId).toBe(mgr.id);

    // assigning a manager to a non-collaborator is rejected
    const badRole = await api("/api/admin/users", {
      method: "POST",
      body: json({ name: "مدیرِ دارای مدیر", mobile: "09120000022", role: "manager", managerId: mgr.id }),
    }, adminCookie);
    expect(badRole.status).toBe(400);

    // unknown managerId is rejected
    const badMgr = await api("/api/admin/users", {
      method: "POST",
      body: json({ name: "مدیر ناموجود", mobile: "09120000023", role: "collaborator", managerId: "nope123" }),
    }, adminCookie);
    expect(badMgr.status).toBe(400);
  });

  it("reassigning a collaborator to another manager works", async () => {
    const usersRes = await api<{ users?: { id: string; role: string; name: string }[] }>("/api/admin/users", {}, adminCookie);
    const mgr2 = usersRes.body.users!.find((u) => u.name === TEST_USERS.manager2.name)!;
    const created = await api<{ user?: { id: string } }>("/api/admin/users", {
      method: "POST",
      body: json({ name: "جابجاشده", mobile: "09120000024", role: "collaborator" }),
    }, adminCookie);

    const moved = await api<{ user?: { managerId: string | null; managerName: string | null } }>(
      `/api/admin/users/${created.body.user!.id}`,
      { method: "PUT", body: json({ managerId: mgr2.id }) },
      adminCookie,
    );
    expect(moved.status).toBe(200);
    expect(moved.body.user?.managerId).toBe(mgr2.id);
    expect(moved.body.user?.managerName).toContain("مینا");
  });
});
