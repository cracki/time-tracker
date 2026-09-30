/**
 * GET /api/admin/logs — logs with filters + pagination (spec §24/§59).
 * admin (مدیر ارشد): all logs, view-only. manager: only their team's logs.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle } from "@/lib/server/api-helpers";
import { requireManagerOrAdmin } from "@/lib/server/auth";
import { logOrderBy, teamUserIds, serializeLog } from "@/lib/server/data";

export async function GET(req: Request) {
  return handle(async () => {
    const actor = await requireManagerOrAdmin();
    const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;
    const userId = url.searchParams.get("userId") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const outsideOnly = url.searchParams.get("outsideOnly") === "1";
    const dayType = url.searchParams.get("dayType") ?? "all";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 30) || 30));

    const dayTypeWhere =
      dayType === "holiday" ? { outsideKind: "holiday" } :
      dayType === "weekend" ? { outsideKind: "weekend" } :
      dayType === "workday" ? { outsideKind: "normal" } :
      {};

    // Team scope: admin sees everyone; a manager only their collaborators.
    // An explicit userId filter is intersected with the scope — a manager
    // asking for another team's collaborator simply gets an empty list.
    const teamIds = await teamUserIds(actor);
    let userIdFilter: Record<string, unknown> | undefined;
    if (userId) {
      userIdFilter = teamIds === null || teamIds.includes(userId) ? { equals: userId } : { in: [] };
    } else if (teamIds !== null) {
      userIdFilter = { in: teamIds };
    }

    const where = {
      ...(from || to ? { workDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(userIdFilter ? { userId: userIdFilter } : {}),
      ...(status ? { status } : {}),
      ...(outsideOnly ? { outsideKind: { not: "normal" } } : {}),
      ...dayTypeWhere,
    };

    const [rows, total] = await Promise.all([
      db.timeLog.findMany({ where, orderBy: logOrderBy(), skip: (page - 1) * pageSize, take: pageSize }),
      db.timeLog.count({ where }),
    ]);

    return NextResponse.json({
      items: rows.map(serializeLog),
      total,
      page,
      hasMore: page * pageSize < total,
    });
  });
}
