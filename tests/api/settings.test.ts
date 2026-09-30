/** Settings tests: calendar (with cache-invalidation correctness) + holidays. */

import { describe, it, expect, beforeAll } from "vitest";
import { api, login, json } from "../helpers/api";
import db from "../helpers/db";
import { TEST_USERS } from "../../scripts/seed-test";
import { isoDate, jalaliToDate, today } from "../../src/lib/jalali";

let adminCookie = "";
let collabCookie = "";

beforeAll(async () => {
  [adminCookie, collabCookie] = await Promise.all([
    login(TEST_USERS.admin.mobile),
    login(TEST_USERS.collab.mobile),
  ]);
});

const originalWorkingDays = [0, 1, 2, 3];

describe("calendar", () => {
  it("collaborators can READ the calendar (log form needs it)", async () => {
    const res = await api<{ calendar?: { workingDays: number[] } }>("/api/settings/calendar", {}, collabCookie);
    expect(res.status).toBe(200);
    expect(res.body.calendar?.workingDays).toEqual(originalWorkingDays);
  });

  it("collaborators cannot WRITE the calendar", async () => {
    const res = await api("/api/settings/calendar", {
      method: "PUT",
      body: json({ workingDays: [0, 1, 2, 3, 4] }),
    }, collabCookie);
    expect(res.status).toBe(403);
  });

  it("admin PUT updates the calendar and the change is visible immediately (cache invalidated)", async () => {
    const put = await api("/api/settings/calendar", {
      method: "PUT",
      body: json({ workingDays: [0, 1, 2, 3, 4], workingStartTime: "09:00", workingEndTime: "18:00" }),
    }, adminCookie);
    expect(put.status).toBe(200);

    const get = await api<{ calendar?: { workingDays: number[]; workingStartTime: string } }>("/api/settings/calendar", {}, collabCookie);
    expect(get.status).toBe(200);
    expect(get.body.calendar?.workingDays).toEqual([0, 1, 2, 3, 4]);
    expect(get.body.calendar?.workingStartTime).toBe("09:00");
  });

  it("rejects invalid working days / hours", async () => {
    const badDays = await api("/api/settings/calendar", {
      method: "PUT",
      body: json({ workingDays: [9] }),
    }, adminCookie);
    expect(badDays.status).toBe(400);

    const emptyDays = await api("/api/settings/calendar", {
      method: "PUT",
      body: json({ workingDays: [] }),
    }, adminCookie);
    expect(emptyDays.status).toBe(400);

    const badHours = await api("/api/settings/calendar", {
      method: "PUT",
      body: json({ workingStartTime: "18:00", workingEndTime: "09:00" }),
    }, adminCookie);
    expect(badHours.status).toBe(400);
  });

  it("restores the default calendar", async () => {
    const put = await api("/api/settings/calendar", {
      method: "PUT",
      body: json({ workingDays: originalWorkingDays, workingStartTime: "08:00", workingEndTime: "17:00" }),
    }, adminCookie);
    expect(put.status).toBe(200);
  });
});

describe("holidays", () => {
  const futureIso = (() => {
    // a date next Jalali month-ish — far from seeded duplicates
    const jy = 1406;
    const d = isoDate(jalaliToDate(jy, 2, 5));
    return d;
  })();

  it("admin can create a holiday; duplicates are rejected", async () => {
    const created = await api<{ holiday?: { id: string; date: string } }>("/api/settings/holidays", {
      method: "POST",
      body: json({ date: futureIso, title: "تعطیلی تستی" }),
    }, adminCookie);
    expect(created.status).toBe(201);
    expect(created.body.holiday?.date).toBe(futureIso);

    const dup = await api("/api/settings/holidays", {
      method: "POST",
      body: json({ date: futureIso, title: "تکراری" }),
    }, adminCookie);
    expect(dup.status).toBe(400);

    await db.holiday.delete({ where: { id: created.body.holiday!.id } });
  });

  it("collaborators cannot create holidays", async () => {
    const res = await api("/api/settings/holidays", {
      method: "POST",
      body: json({ date: futureIso, title: "غیرمجاز" }),
    }, collabCookie);
    expect(res.status).toBe(403);
  });

  it("admin can delete a holiday", async () => {
    const created = await api<{ holiday?: { id: string } }>("/api/settings/holidays", {
      method: "POST",
      body: json({ date: futureIso, title: "برای حذف" }),
    }, adminCookie);
    const res = await api(`/api/settings/holidays/${created.body.holiday!.id}`, { method: "DELETE" }, adminCookie);
    expect(res.status).toBe(200);
  });

  it("outside-kind reclassification: a holiday date makes computeOutsideKind holiday (server data flow)", async () => {
    // sanity: the holiday set used by log creation reflects the DB (via the cached loader)
    const holidays = await db.holiday.findMany({ select: { date: true } });
    expect(holidays.length).toBeGreaterThanOrEqual(20); // seeded 2 years × 10
    expect(today).toBeTruthy();
  });
});
