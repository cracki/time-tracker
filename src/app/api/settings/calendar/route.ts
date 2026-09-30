/**
 * GET /api/settings/calendar — { calendar, holidays } (admin screens)
 * PUT /api/settings/calendar — update working days/hours (admin only)
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, readJson, ServerError } from "@/lib/server/api-helpers";
import { requireAdmin, requireUser } from "@/lib/server/auth";
import { getCalendar, invalidateCalendarCache } from "@/lib/server/data";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET() {
  return handle(async () => {
    // any signed-in user: the log form uses calendar/holidays for hints
    await requireUser();
    const [calendar, holidays] = await Promise.all([
      getCalendar(),
      db.holiday.findMany({ orderBy: { date: "asc" } }),
    ]);
    return NextResponse.json({ calendar, holidays });
  });
}

export async function PUT(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await readJson<{
      workingDays?: number[];
      workingStartTime?: string;
      workingEndTime?: string;
    }>(req);

    const data: { workingDaysJson?: string; workingStartTime?: string; workingEndTime?: string } = {};

    if (body.workingDays !== undefined) {
      if (!Array.isArray(body.workingDays) || body.workingDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
        throw new ServerError("روزهای کاری نامعتبر هستند.", "validation");
      }
      if (body.workingDays.length === 0) {
        throw new ServerError("حداقل یک روز کاری انتخاب کنید.", "validation");
      }
      data.workingDaysJson = JSON.stringify([...new Set(body.workingDays)].sort());
    }
    if (body.workingStartTime !== undefined) {
      if (!TIME_RE.test(body.workingStartTime)) throw new ServerError("ساعت شروع نامعتبر است.", "validation");
      data.workingStartTime = body.workingStartTime;
    }
    if (body.workingEndTime !== undefined) {
      if (!TIME_RE.test(body.workingEndTime)) throw new ServerError("ساعت پایان نامعتبر است.", "validation");
      data.workingEndTime = body.workingEndTime;
    }
    if (data.workingStartTime && data.workingEndTime && data.workingStartTime >= data.workingEndTime) {
      throw new ServerError("ساعت شروع باید قبل از ساعت پایان باشد.", "validation");
    }

    await db.calendarSettings.upsert({
      where: { id: "main" },
      create: { id: "main", ...data },
      update: data,
    });
    invalidateCalendarCache();

    const [calendar, holidays] = await Promise.all([
      getCalendar(),
      db.holiday.findMany({ orderBy: { date: "asc" } }),
    ]);
    return NextResponse.json({ calendar, holidays });
  });
}
