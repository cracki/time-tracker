/** GET /api/admin/outside-hours?from&to — outside-hours report (spec §28/§64). */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle } from "@/lib/server/api-helpers";
import { requireManagerOrAdmin } from "@/lib/server/auth";
import { teamUserIds, serializeLog, serializeUser } from "@/lib/server/data";

export async function GET(req: Request) {
  return handle(async () => {
    const actor = await requireManagerOrAdmin();
    const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;

    const dateWhere = from || to
      ? { workDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
      : {};

    const teamIds = await teamUserIds(actor);
    const [users, logs] = await Promise.all([
      db.user.findMany({
        where: { role: "collaborator", ...(teamIds === null ? {} : { managerId: actor.id }) },
        include: { manager: { select: { name: true } } },
      }),
      db.timeLog.findMany({
        where: { ...dateWhere, ...(teamIds === null ? {} : { userId: { in: teamIds } }) },
        orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      }),
    ]);

    const rows = users
      .map((u) => {
        const mine = logs.filter((l) => l.userId === u.id);
        const outsideLogs = mine.filter((l) => l.outsideKind !== "normal");
        return {
          user: serializeUser(u),
          outsideMinutes: outsideLogs.reduce((s, l) => s + l.originalDurationMinutes, 0),
          totalMinutes: mine.reduce((s, l) => s + l.originalDurationMinutes, 0),
          logs: outsideLogs.map(serializeLog),
        };
      })
      .filter((r) => r.outsideMinutes > 0)
      .sort((a, b) => b.outsideMinutes - a.outsideMinutes);

    return NextResponse.json({
      rows,
      total: rows.reduce((s, r) => s + r.outsideMinutes, 0),
    });
  });
}
