/**
 * GET    /api/logs/[id] — log detail with owner info (owner or admin)
 * PUT    /api/logs/[id] — edit (owner, pending only)
 * DELETE /api/logs/[id] — delete (owner, pending only)
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, readJson, requireString, ServerError } from "@/lib/server/api-helpers";
import { requireUser } from "@/lib/server/auth";
import { assertWorkDateInRange, computeOutsideKind, parseWorkDate } from "@/lib/server/rules";
import { getCalendar, getHolidayDates, serializeLog, serializeUser } from "@/lib/server/data";

type Ctx = { params: Promise<{ id: string }> };

async function loadLog(id: string) {
  const log = await db.timeLog.findUnique({ where: { id }, include: { user: true } });
  if (!log) throw new ServerError("گزارش پیدا نشد.", "not_found");
  return log;
}

export async function GET(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const log = await loadLog(id);
    // owner · supreme admin (view-only) · the owner's team manager
    const isTeamManager = user.role === "manager" && log.user.managerId === user.id;
    if (log.userId !== user.id && user.role !== "admin" && !isTeamManager) {
      throw new ServerError("دسترسی غیرمجاز.", "forbidden");
    }
    return NextResponse.json({
      log: serializeLog(log),
      user: serializeUser(log.user),
    });
  });
}

export async function PUT(req: Request, ctx: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const existing = await loadLog(id);
    if (existing.userId !== user.id) throw new ServerError("دسترسی غیرمجاز.", "forbidden");
    if (existing.status !== "pending") {
      throw new ServerError("فقط گزارش‌های در انتظار تأیید قابل ویرایش هستند.", "forbidden");
    }

    const body = await readJson<{ workDate?: string; description?: string; durationMinutes?: number }>(req);
    const data: {
      description?: string;
      originalDurationMinutes?: number;
      workDate?: string;
      outsideKind?: string;
    } = {};

    if (body.description !== undefined) {
      const d = requireString(body.description, "توضیحات", { max: 200 });
      data.description = d;
    }
    if (body.durationMinutes !== undefined) {
      const duration = Number(body.durationMinutes);
      if (!Number.isFinite(duration) || duration <= 0 || duration > 24 * 60) {
        throw new ServerError("مدت زمان نامعتبر است.", "validation");
      }
      data.originalDurationMinutes = Math.round(duration);
    }
    if (body.workDate !== undefined && body.workDate !== existing.workDate) {
      const workDate = parseWorkDate(body.workDate);
      assertWorkDateInRange(workDate);
      data.workDate = workDate;
      const [calendar, holidays] = await Promise.all([getCalendar(), getHolidayDates()]);
      data.outsideKind = computeOutsideKind(workDate, calendar.workingDays, holidays);
    }

    const log = await db.timeLog.update({ where: { id }, data });
    return NextResponse.json({ log: serializeLog(log) });
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const existing = await loadLog(id);
    if (existing.userId !== user.id) throw new ServerError("دسترسی غیرمجاز.", "forbidden");
    if (existing.status !== "pending") {
      throw new ServerError("فقط گزارش‌های در انتظار تأیید قابل حذف هستند.", "forbidden");
    }
    await db.timeLog.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
