/** GET /api/admin/people/[id]/summary?from&to — one person's summary + logs + per-day (spec §63). */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, ServerError } from "@/lib/server/api-helpers";
import { requireAdmin } from "@/lib/server/auth";
import { serializeLog, serializeUser } from "@/lib/server/data";
import { addDays, isoDate, parseIso } from "@/lib/jalali";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    const user = await db.user.findUnique({ where: { id } });
    if (!user) throw new ServerError("کاربر پیدا نشد.", "not_found");

    const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;

    const logs = await db.timeLog.findMany({
      where: { userId: id, ...(from || to ? { workDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
    });

    const byDay: { date: string; minutes: number; approved: number }[] = [];
    if (from && to) {
      for (let d = parseIso(from); isoDate(d) <= to; d = addDays(d, 1)) {
        const iso = isoDate(d);
        const dayLogs = logs.filter((l) => l.workDate === iso);
        byDay.push({
          date: iso,
          minutes: dayLogs.reduce((s, l) => s + l.originalDurationMinutes, 0),
          approved: dayLogs.reduce((s, l) => s + (l.approvedDurationMinutes ?? 0), 0),
        });
      }
    }

    return NextResponse.json({
      summary: {
        user: serializeUser(user),
        totalLoggedMinutes: logs.reduce((s, l) => s + l.originalDurationMinutes, 0),
        totalApprovedMinutes: logs.reduce((s, l) => s + (l.approvedDurationMinutes ?? 0), 0),
        pendingMinutes: logs.filter((l) => l.status === "pending").reduce((s, l) => s + l.originalDurationMinutes, 0),
        adjustedCount: logs.filter((l) => l.status === "adjusted").length,
        rejectedMinutes: logs.filter((l) => l.status === "rejected").reduce((s, l) => s + l.originalDurationMinutes, 0),
        outsideMinutes: logs.filter((l) => l.outsideKind !== "normal").reduce((s, l) => s + l.originalDurationMinutes, 0),
        logCount: logs.length,
      },
      logs: logs.map(serializeLog),
      byDay,
    });
  });
}
