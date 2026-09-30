/** GET /api/admin/dashboard?from&to — admin overview aggregates (spec §22). */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle } from "@/lib/server/api-helpers";
import { requireAdmin } from "@/lib/server/auth";
import { tehranDaysAgoIso, tehranTodayIso } from "@/lib/server/rules";
import { serializeLog, serializeUser } from "@/lib/server/data";
import { addDays, isoDate, parseIso } from "@/lib/jalali";

export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? tehranDaysAgoIso(29);
    const to = url.searchParams.get("to") ?? tehranTodayIso();

    const logs = await db.timeLog.findMany({
      where: { workDate: { gte: from, lte: to } },
    });
    const logged = (arr: typeof logs) => arr.reduce((s, l) => s + l.originalDurationMinutes, 0);

    // 30-day trend
    const trend: { date: string; logged: number; approved: number }[] = [];
    for (let d = parseIso(from); isoDate(d) <= to; d = addDays(d, 1)) {
      const iso = isoDate(d);
      const dayLogs = logs.filter((l) => l.workDate === iso);
      trend.push({
        date: iso,
        logged: logged(dayLogs),
        approved: dayLogs.reduce((s, l) => s + (l.approvedDurationMinutes ?? 0), 0),
      });
    }

    const collaborators = await db.user.findMany({ where: { role: "collaborator" } });
    const perUser = collaborators
      .map((u) => ({ user: serializeUser(u), minutes: logged(logs.filter((l) => l.userId === u.id)) }))
      .sort((a, b) => b.minutes - a.minutes);

    const activeTodaySet = new Set(
      (await db.timeLog.findMany({ where: { workDate: tehranTodayIso() }, select: { userId: true } })).map((r) => r.userId),
    );

    const recentPending = await db.timeLog.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    return NextResponse.json({
      totalLogged: logged(logs),
      totalApproved: logs.reduce((s, l) => s + (l.approvedDurationMinutes ?? 0), 0),
      pendingMinutes: logged(logs.filter((l) => l.status === "pending")),
      pendingCount: logs.filter((l) => l.status === "pending").length,
      adjustedMinutes: logs.filter((l) => l.status === "adjusted").reduce((s, l) => s + (l.approvedDurationMinutes ?? 0), 0),
      adjustedCount: logs.filter((l) => l.status === "adjusted").length,
      rejectedMinutes: logged(logs.filter((l) => l.status === "rejected")),
      outsideMinutes: logged(logs.filter((l) => l.outsideKind !== "normal")),
      peopleCount: await db.user.count(),
      activeToday: activeTodaySet.size,
      trend,
      statusDist: (["approved", "adjusted", "pending", "rejected"] as const).map((s) => ({
        status: s,
        minutes: logged(logs.filter((l) => l.status === s)),
        count: logs.filter((l) => l.status === s).length,
      })),
      peopleTop: perUser.slice(0, 7),
      recentPending: recentPending.map(serializeLog),
    });
  });
}
