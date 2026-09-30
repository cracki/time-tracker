/** GET /api/admin/logs — all logs with filters + pagination (spec §24/§59). */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle } from "@/lib/server/api-helpers";
import { requireAdmin } from "@/lib/server/auth";
import { logOrderBy, serializeLog } from "@/lib/server/data";

export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
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

    const where = {
      ...(from || to ? { workDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(userId ? { userId } : {}),
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
