/** GET /api/collab/dashboard — collaborator home aggregates (spec §13/§60). */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle } from "@/lib/server/api-helpers";
import { requireUser } from "@/lib/server/auth";
import { tehranTodayIso } from "@/lib/server/rules";
import { serializeLog, serializeUser } from "@/lib/server/data";
import { isoDate, parseIso, startOfJMonth, startOfJWeek } from "@/lib/jalali";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const t = tehranTodayIso();
    const todayDate = parseIso(t); // local-midnight frame — consistent with jalali helpers
    const weekStart = isoDate(startOfJWeek(todayDate));
    const monthStart = isoDate(startOfJMonth(todayDate));

    const mine = await db.timeLog.findMany({ where: { userId: user.id } });
    const inRange = (from?: string, to?: string) =>
      mine.filter((l) => l.workDate >= (from ?? "0000") && l.workDate <= (to ?? "9999"));

    const todayLogs = inRange(t, t);
    const weekLogs = inRange(weekStart, t);
    const monthLogs = inRange(monthStart, t);
    const logged = (arr: typeof mine) => arr.reduce((s, l) => s + l.originalDurationMinutes, 0);

    const [recent, lastLog] = await Promise.all([
      db.timeLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 6 }),
      db.timeLog.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    ]);

    return NextResponse.json({
      user: serializeUser(user),
      todayLogged: logged(todayLogs),
      todayCount: todayLogs.length,
      weekLogged: logged(weekLogs),
      monthLogged: logged(monthLogs),
      approvedMinutes: mine.reduce((s, l) => s + (l.approvedDurationMinutes ?? 0), 0),
      pendingMinutes: logged(mine.filter((l) => l.status === "pending")),
      pendingCount: mine.filter((l) => l.status === "pending").length,
      rejectedMinutes: logged(mine.filter((l) => l.status === "rejected")),
      adjustedCount: mine.filter((l) => l.status === "adjusted").length,
      outsideMinutes: logged(mine.filter((l) => l.outsideKind !== "normal")),
      recent: recent.map(serializeLog),
      lastLog: lastLog ? serializeLog(lastLog) : null,
    });
  });
}
