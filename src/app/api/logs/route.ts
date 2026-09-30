/**
 * GET  /api/logs — my logs with filters (spec §14/§59)
 * POST /api/logs — create log (spec §15: description/duration/date rules)
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, readJson, ServerError, requireString } from "@/lib/server/api-helpers";
import { requireUser } from "@/lib/server/auth";
import { computeOutsideKind, parseWorkDate, assertWorkDateInRange } from "@/lib/server/rules";
import { getCalendar, getHolidayDates, logOrderBy, serializeLog } from "@/lib/server/data";

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const outsideOnly = url.searchParams.get("outsideOnly") === "1";

    const logs = await db.timeLog.findMany({
      where: {
        userId: user.id,
        ...(from ? { workDate: { gte: from } } : {}),
        ...(to ? { workDate: { lte: to } } : {}),
        ...(status ? { status } : {}),
        ...(outsideOnly ? { outsideKind: { not: "normal" } } : {}),
      },
      orderBy: logOrderBy(),
    });
    return NextResponse.json({ items: logs.map(serializeLog) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = await readJson<{ workDate?: string; description?: string; durationMinutes?: number }>(req);

    const description = requireString(body.description, "توضیحات", { max: 200 });
    const duration = Number(body.durationMinutes);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 24 * 60) {
      throw new ServerError("مدت زمان نامعتبر است.", "validation");
    }
    const workDate = parseWorkDate(body.workDate);
    assertWorkDateInRange(workDate);

    const [calendar, holidays] = await Promise.all([getCalendar(), getHolidayDates()]);
    const log = await db.timeLog.create({
      data: {
        userId: user.id,
        workDate,
        description,
        originalDurationMinutes: Math.round(duration),
        status: "pending",
        outsideKind: computeOutsideKind(workDate, calendar.workingDays, holidays),
      },
    });
    return NextResponse.json({ log: serializeLog(log) }, { status: 201 });
  });
}
