/**
 * PUT    /api/admin/users/[id] — edit user (name/mobile/role/isActive/avatarColor)
 * DELETE /api/admin/users/[id] — delete user (only when they have no logs)
 *
 * Protections:
 *   - can't edit yourself into collaborator / inactive (lockout guard)
 *   - can't demote or deactivate the LAST active admin
 *   - delete blocked when the user has logs (suggest deactivation instead)
 *   - mobile uniqueness on change
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, readJson, requireString, ServerError } from "@/lib/server/api-helpers";
import { requireAdmin, toPublicUser } from "@/lib/server/auth";
import { isValidMobile } from "@/lib/server/rules";

type Ctx = { params: Promise<{ id: string }> };

async function countActiveAdmins(excludeId?: string): Promise<number> {
  return db.user.count({ where: { role: "admin", isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}) } });
}

export async function PUT(req: Request, ctx: Ctx) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const target = await db.user.findUnique({ where: { id } });
    if (!target) throw new ServerError("کاربر پیدا نشد.", "not_found");

    const body = await readJson<{
      name?: string;
      mobile?: string;
      role?: string;
      isActive?: boolean;
      avatarColor?: string;
    }>(req);

    const data: {
      name?: string;
      mobile?: string;
      role?: string;
      isActive?: boolean;
      avatarColor?: string;
    } = {};

    if (body.name !== undefined) data.name = requireString(body.name, "نام و نام خانوادگی", { max: 60 });

    if (body.mobile !== undefined && body.mobile !== target.mobile) {
      if (!isValidMobile(body.mobile)) {
        throw new ServerError("شماره موبایل معتبر نیست (مثال: 09123456789).", "validation");
      }
      const dup = await db.user.findUnique({ where: { mobile: body.mobile } });
      if (dup) throw new ServerError("کاربری با این شماره موبایل قبلاً ثبت شده است.", "validation");
      data.mobile = body.mobile;
    }

    const newRole = body.role === "admin" ? "admin" : body.role === "collaborator" ? "collaborator" : undefined;
    const newActive = typeof body.isActive === "boolean" ? body.isActive : undefined;

    const isSelf = target.id === admin.id;
    const losesAdminAccess =
      isSelf &&
      ((newRole !== undefined && newRole !== "admin") || (newActive !== undefined && newActive === false));
    if (losesAdminAccess) {
      throw new ServerError("نمی‌توانید دسترسی مدیر خودتان را حذف کنید.", "forbidden");
    }

    if ((newRole !== undefined && newRole !== target.role) || (newActive !== undefined && newActive !== target.isActive)) {
      const wasActiveAdmin = target.role === "admin" && target.isActive;
      const willBeActiveAdmin =
        (newRole ?? target.role) === "admin" && (newActive ?? target.isActive);
      if (wasActiveAdmin && !willBeActiveAdmin && (await countActiveAdmins(target.id)) === 0) {
        throw new ServerError("حداقل یک مدیر فعال باید باقی بماند.", "forbidden");
      }
    }

    if (newRole !== undefined) data.role = newRole;
    if (newActive !== undefined) data.isActive = newActive;
    if (body.avatarColor !== undefined) {
      if (typeof body.avatarColor !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(body.avatarColor)) {
        throw new ServerError("رنگ آواتار نامعتبر است.", "validation");
      }
      data.avatarColor = body.avatarColor;
    }

    const user = await db.user.update({ where: { id }, data });
    return NextResponse.json({ user: toPublicUser(user) });
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const target = await db.user.findUnique({
      where: { id },
      include: { _count: { select: { logs: true } } },
    });
    if (!target) throw new ServerError("کاربر پیدا نشد.", "not_found");

    if (target.id === admin.id) {
      throw new ServerError("نمی‌توانید حساب خودتان را حذف کنید.", "forbidden");
    }
    if (target._count.logs > 0) {
      throw new ServerError(
        "این کاربر گزارش ثبت‌شده دارد — برای حفظ سابقه، حساب را غیرفعال کنید.",
        "validation",
      );
    }

    await db.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  });
}
