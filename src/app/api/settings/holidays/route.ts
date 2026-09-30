/**
 * POST /api/settings/holidays — add a holiday (admin only)
 * DELETE not needed here; see /api/settings/holidays/[id]
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, readJson, ServerError, requireString } from "@/lib/server/api-helpers";
import { requireAdmin } from "@/lib/server/auth";
import { parseWorkDate } from "@/lib/server/rules";
import { invalidateCalendarCache } from "@/lib/server/data";

export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await readJson<{ date?: string; title?: string }>(req);
    const date = parseWorkDate(body.date, "تاریخ تعطیلی");
    const title = requireString(body.title, "عنوان تعطیلی", { max: 60 });

    const dup = await db.holiday.findUnique({ where: { date } });
    if (dup) throw new ServerError("برای این تاریخ قبلاً تعطیلی ثبت شده است.", "validation");

    const holiday = await db.holiday.create({ data: { date, title } });
    invalidateCalendarCache();
    return NextResponse.json({ holiday }, { status: 201 });
  });
}
