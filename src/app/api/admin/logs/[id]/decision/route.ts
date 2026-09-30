/**
 * POST /api/admin/logs/[id]/decision — approve | adjust | reject (spec §19).
 * ONLY the collaborator's own team manager (role=manager) may decide.
 * The supreme admin (role=admin) is a viewer and can never decide.
 * Only pending logs are decidable; every decision stamps the manager.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, readJson, ServerError } from "@/lib/server/api-helpers";
import { requireManager } from "@/lib/server/auth";
import { serializeLog } from "@/lib/server/data";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    const manager = await requireManager();
    const { id } = await ctx.params;
    const body = await readJson<{
      action?: "approve" | "adjust" | "reject";
      minutes?: number;
      note?: string;
      reason?: string;
    }>(req);

    const log = await db.timeLog.findUnique({ where: { id } });
    if (!log) throw new ServerError("گزارش پیدا نشد.", "not_found");

    // Hierarchy guard: the log owner must be one of this manager's collaborators
    const owner = await db.user.findUnique({ where: { id: log.userId }, select: { managerId: true } });
    if (!owner || owner.managerId !== manager.id) {
      throw new ServerError("این گزارش تحت مدیریت شما نیست.", "forbidden");
    }

    if (log.status !== "pending") {
      throw new ServerError("این گزارش قبلاً تصمیم‌گیری شده است.", "forbidden");
    }

    const now = new Date();
    const stamp = {
      approvedBy: manager.id,
      approvedByName: manager.name,
      approvedAt: now,
      updatedAt: now,
    };

    if (body.action === "approve") {
      const updated = await db.timeLog.update({
        where: { id },
        data: { status: "approved", approvedDurationMinutes: log.originalDurationMinutes, rejectionReason: null, adminNote: null, ...stamp },
      });
      return NextResponse.json({ log: serializeLog(updated) });
    }

    if (body.action === "adjust") {
      const minutes = Number(body.minutes);
      if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 24 * 60) {
        throw new ServerError("زمان تأییدشده نامعتبر است.", "validation");
      }
      const updated = await db.timeLog.update({
        where: { id },
        data: {
          status: "adjusted",
          approvedDurationMinutes: Math.round(minutes),
          adminNote: typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 200) : null,
          rejectionReason: null,
          ...stamp,
        },
      });
      return NextResponse.json({ log: serializeLog(updated) });
    }

    if (body.action === "reject") {
      const updated = await db.timeLog.update({
        where: { id },
        data: {
          status: "rejected",
          approvedDurationMinutes: null,
          rejectionReason: typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 200) : null,
          ...stamp,
        },
      });
      return NextResponse.json({ log: serializeLog(updated) });
    }

    throw new ServerError("نوع تصمیم نامعتبر است.", "validation");
  });
}
