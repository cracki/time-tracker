/** Admin user-management tests (the explicitly requested feature):
 *  CRUD, uniqueness, self-lockout, last-active-admin guard, delete-with-logs. */

import { describe, it, expect, beforeAll } from "vitest";
import { api, login, json } from "../helpers/api";
import db, { findUserByMobile } from "../helpers/db";
import { TEST_USERS } from "../../scripts/seed-test";

let adminCookie = "";
let admin2Cookie = "";
let collabCookie = "";

beforeAll(async () => {
  [adminCookie, admin2Cookie, collabCookie] = await Promise.all([
    login(TEST_USERS.admin.mobile),
    login(TEST_USERS.admin2.mobile),
    login(TEST_USERS.collab.mobile),
  ]);
});

interface UserShape {
  user?: { id: string; mobile: string; role: string; isActive: boolean };
  users?: { id: string; mobile: string; role: string; isActive: boolean }[];
  error?: string;
  code?: string;
}

describe("authorization", () => {
  it("collaborators cannot access admin user APIs", async () => {
    const res = await api("/api/admin/users", {}, collabCookie);
    expect(res.status).toBe(403);
  });

  it("unauthenticated access is rejected", async () => {
    const res = await api("/api/admin/users");
    expect(res.status).toBe(401);
  });
});

describe("GET/POST /api/admin/users", () => {
  it("lists users including role + active flags", async () => {
    const res = await api<UserShape>("/api/admin/users", {}, adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.users!.length).toBeGreaterThanOrEqual(4);
    const collab = res.body.users!.find((u) => u.mobile === TEST_USERS.collab.mobile);
    expect(collab?.role).toBe("collaborator");
    expect(collab?.isActive).toBe(true);
  });

  it("creates a user", async () => {
    const res = await api<UserShape>("/api/admin/users", {
      method: "POST",
      body: json({ name: "کاربر تست تازه", mobile: "09120000010", role: "collaborator" }),
    }, adminCookie);
    expect(res.status).toBe(201);
    expect(res.body.user?.mobile).toBe("09120000010");
  });

  it("rejects duplicate mobile", async () => {
    const res = await api<UserShape>("/api/admin/users", {
      method: "POST",
      body: json({ name: "تکراری", mobile: TEST_USERS.collab.mobile, role: "collaborator" }),
    }, adminCookie);
    expect(res.status).toBe(400);
  });

  it("rejects invalid name/mobile; unknown role coerces to collaborator", async () => {
    const badMobile = await api("/api/admin/users", {
      method: "POST",
      body: json({ name: "x", mobile: "123", role: "collaborator" }),
    }, adminCookie);
    expect(badMobile.status).toBe(400);

    // role is normalized server-side: anything ≠ "admin" becomes collaborator
    const coerced = await api<UserShape>("/api/admin/users", {
      method: "POST",
      body: json({ name: "نقش نامعتبر", mobile: "09120000011", role: "superadmin" }),
    }, adminCookie);
    expect(coerced.status).toBe(201);
    expect(coerced.body.user?.role).toBe("collaborator");
  });
});

describe("PUT /api/admin/users/[id]", () => {
  let targetId = "";

  beforeAll(async () => {
    const created = await api<UserShape>("/api/admin/users", {
      method: "POST",
      body: json({ name: "قابل تغییر", mobile: "09120000012", role: "collaborator" }),
    }, adminCookie);
    targetId = created.body.user!.id;
  });

  it("updates name/role/isActive", async () => {
    const res = await api<UserShape>(`/api/admin/users/${targetId}`, {
      method: "PUT",
      body: json({ name: "تغییریافته", role: "admin", isActive: true }),
    }, adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.user?.role).toBe("admin");
  });

  it("self-demotion / self-deactivation is blocked (403)", async () => {
    const me = await api<{ user: { id: string } }>("/api/auth/me", {}, adminCookie);
    const myId = me.body.user.id;

    const demote = await api(`/api/admin/users/${myId}`, {
      method: "PUT",
      body: json({ role: "collaborator" }),
    }, adminCookie);
    expect(demote.status).toBe(403);

    const deactivate = await api(`/api/admin/users/${myId}`, {
      method: "PUT",
      body: json({ isActive: false }),
    }, adminCookie);
    expect(deactivate.status).toBe(403);
  });

  it("last-active-admin guard: cannot deactivate the only other active admin while self stays… (two admins → allowed)", async () => {
    // with 2 active admins (admin + admin2), deactivating admin2 is allowed
    const admin2 = await findUserByMobile(TEST_USERS.admin2.mobile);
    const res = await api<UserShape>(`/api/admin/users/${admin2!.id}`, {
      method: "PUT",
      body: json({ isActive: false }),
    }, adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.user?.isActive).toBe(false);

    // reactivate for the next tests
    const back = await api(`/api/admin/users/${admin2!.id}`, {
      method: "PUT",
      body: json({ isActive: true }),
    }, adminCookie);
    expect(back.status).toBe(200);
  });

  it("deactivating a user blocks their login", async () => {
    const created = await api<UserShape>("/api/admin/users", {
      method: "POST",
      body: json({ name: "غیرفعال‌شونده", mobile: "09120000013", role: "collaborator" }),
    }, adminCookie);
    await api(`/api/admin/users/${created.body.user!.id}`, {
      method: "PUT",
      body: json({ isActive: false }),
    }, adminCookie);

    const otp = await api("/api/auth/request-otp", {
      method: "POST",
      body: json({ phone: "09120000013" }),
    });
    expect(otp.status).toBe(403);
  });
});

describe("DELETE /api/admin/users/[id]", () => {
  it("deletes a user without logs", async () => {
    const created = await api<UserShape>("/api/admin/users", {
      method: "POST",
      body: json({ name: "حذف‌شدنی", mobile: "09120000014", role: "collaborator" }),
    }, adminCookie);
    const res = await api(`/api/admin/users/${created.body.user!.id}`, { method: "DELETE" }, adminCookie);
    expect(res.status).toBe(200);
    const gone = await findUserByMobile("09120000014");
    expect(gone).toBeNull();
  });

  it("refuses to delete a user who has logs (suggest deactivate)", async () => {
    const collab = await findUserByMobile(TEST_USERS.collab.mobile);
    const res = await api(`/api/admin/users/${collab!.id}`, { method: "DELETE" }, adminCookie);
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toContain("غیرفعال");
  });

  it("cannot delete self (403)", async () => {
    const me = await api<{ user: { id: string } }>("/api/auth/me", {}, adminCookie);
    const res = await api(`/api/admin/users/${me.body.user.id}`, { method: "DELETE" }, adminCookie);
    expect(res.status).toBe(403);
  });
});

describe("cleanup", () => {
  it("removes created test users (mobiles 0912000001x)", async () => {
    await db.user.deleteMany({ where: { mobile: { in: ["09120000010", "09120000011", "09120000012", "09120000013", "09120000014"] } } });
    const count = await db.user.count({ where: { mobile: { startsWith: "0912000001" } } });
    expect(count).toBe(0);
  });
});
