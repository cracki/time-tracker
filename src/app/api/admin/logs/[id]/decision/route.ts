/**
 * POST /api/admin/logs/[id]/decision — approve | adjust | reject (spec §19).
 * Only pending logs are decidable; every decision stamps the admin.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, readJson, ServerError } from "@/lib/server/api-helpers";
import { requireAdmin } from "@/lib/server/auth";
import { serializeLog } from "@/lib/server/data";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const body = await readJson<{
      action?: "approve" | "adjust" | "reject";
      minutes?: number;
      note?: string;
      reason?: string;
    }>(req);

    const log = await db.timeLog.findUnique({ where: { id } });
    if (!log) throw new ServerError("گزارش پیدا نشد.", "not_found");
    if (log.status !== "pending") {
      throw new ServerError("این گزارش قبلاً تصمیم‌گیری شده است.", "forbidden");
    }

    const now = new Date();
    const stamp = {
      approvedBy: admin.id,
      approvedByName: admin.name,
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
