/** GET /api/admin/people?from&to&sort — per-person summaries (spec §23/§62). */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle } from "@/lib/server/api-helpers";
import { requireManagerOrAdmin } from "@/lib/server/auth";
import { teamUserIds } from "@/lib/server/data";
import { serializeUser } from "@/lib/server/data";
import { isoDate, presetRange } from "@/lib/jalali";

export async function GET(req: Request) {
  return handle(async () => {
    const actor = await requireManagerOrAdmin();
    const url = new URL(req.url);
    const sort = url.searchParams.get("sort") ?? "most";
    const preset = url.searchParams.get("preset") ?? "";
    let from = url.searchParams.get("from") ?? undefined;
    let to = url.searchParams.get("to") ?? undefined;

    if (!from || !to) {
      const r = presetRange(preset);
      if (r) {
        from = isoDate(r.from);
        to = isoDate(r.to);
      }
    }

    const teamIds = await teamUserIds(actor);
    const users = await db.user.findMany({
      where: { role: "collaborator", ...(teamIds === null ? {} : { managerId: actor.id }) },
      include: { manager: { select: { name: true } } },
    });
    const logs = await db.timeLog.findMany({
      where: {
        ...(from || to ? { workDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
    });

    const summaries = users.map((u) => {
      const mine = logs.filter((l) => l.userId === u.id);
      return {
        user: serializeUser(u),
        totalLoggedMinutes: mine.reduce((s, l) => s + l.originalDurationMinutes, 0),
        totalApprovedMinutes: mine.reduce((s, l) => s + (l.approvedDurationMinutes ?? 0), 0),
        pendingMinutes: mine.filter((l) => l.status === "pending").reduce((s, l) => s + l.originalDurationMinutes, 0),
        adjustedCount: mine.filter((l) => l.status === "adjusted").length,
        rejectedMinutes: mine.filter((l) => l.status === "rejected").reduce((s, l) => s + l.originalDurationMinutes, 0),
        outsideMinutes: mine.filter((l) => l.outsideKind !== "normal").reduce((s, l) => s + l.originalDurationMinutes, 0),
        logCount: mine.length,
      };
    });

    switch (sort) {
      case "least": summaries.sort((a, b) => a.totalLoggedMinutes - b.totalLoggedMinutes); break;
      case "mostApproved": summaries.sort((a, b) => b.totalApprovedMinutes - a.totalApprovedMinutes); break;
      case "mostOutside": summaries.sort((a, b) => b.outsideMinutes - a.outsideMinutes); break;
      default: summaries.sort((a, b) => b.totalLoggedMinutes - a.totalLoggedMinutes);
    }

    return NextResponse.json(summaries);
  });
}
