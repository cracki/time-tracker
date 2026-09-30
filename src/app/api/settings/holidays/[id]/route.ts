/** DELETE /api/settings/holidays/[id] — remove a holiday (admin only). */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, ServerError } from "@/lib/server/api-helpers";
import { requireAdmin } from "@/lib/server/auth";
import { invalidateCalendarCache } from "@/lib/server/data";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    const existing = await db.holiday.findUnique({ where: { id } });
    if (!existing) throw new ServerError("تعطیلی پیدا نشد.", "not_found");
    await db.holiday.delete({ where: { id } });
    invalidateCalendarCache();
    return NextResponse.json({ ok: true });
  });
}
