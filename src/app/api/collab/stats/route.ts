/** GET /api/collab/stats?from&to — personal statistics (spec §25/§61). */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle } from "@/lib/server/api-helpers";
import { requireUser } from "@/lib/server/auth";
import { parseWorkDate } from "@/lib/server/rules";
import { addDays, parseIso, isoDate } from "@/lib/jalali";

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const from = parseWorkDate(url.searchParams.get("from"), "تاریخ شروع");
    const to = parseWorkDate(url.searchParams.get("to"), "تاریخ پایان");

    const mine = await db.timeLog.findMany({
      where: { userId: user.id, workDate: { gte: from, lte: to } },
    });

    const byDay: { date: string; minutes: number; approved: number }[] = [];
    for (let d = parseIso(from); isoDate(d) <= to; d = addDays(d, 1)) {
      const iso = isoDate(d);
      const dayLogs = mine.filter((l) => l.workDate === iso);
      byDay.push({
        date: iso,
        minutes: dayLogs.reduce((s, l) => s + l.originalDurationMinutes, 0),
        approved: dayLogs.reduce((s, l) => s + (l.approvedDurationMinutes ?? 0), 0),
      });
    }

    const statusDist = (["approved", "adjusted", "pending", "rejected"] as const).map((s) => ({
      status: s,
      minutes: mine
        .filter((l) => l.status === s)
        .reduce((a, l) => a + (s === "approved" || s === "adjusted" ? l.approvedDurationMinutes ?? 0 : l.originalDurationMinutes), 0),
      count: mine.filter((l) => l.status === s).length,
    }));

    return NextResponse.json({
      byDay,
      statusDist,
      outsideMinutes: mine.filter((l) => l.outsideKind !== "normal").reduce((s, l) => s + l.originalDurationMinutes, 0),
      totalMinutes: mine.reduce((s, l) => s + l.originalDurationMinutes, 0),
      approvedMinutes: mine.reduce((s, l) => s + (l.approvedDurationMinutes ?? 0), 0),
      logCount: mine.length,
    });
  });
}
