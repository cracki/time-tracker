/**
 * GET  /api/admin/users — list all users (with per-user log counts)
 * POST /api/admin/users — create user (spec §7 user management)
 *
 * Protections (both routes + [id] route):
 *   - unique mobile (09xxxxxxxxx)
 *   - can't demote/deactivate yourself
 *   - can't demote/deactivate the last active admin
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, readJson, requireString, ServerError } from "@/lib/server/api-helpers";
import { requireAdmin, toPublicUser } from "@/lib/server/auth";
import { isValidMobile } from "@/lib/server/rules";

const AVATAR_COLORS = [
  "#0F766E", "#B45309", "#7C3AED", "#BE185D", "#15803D",
  "#B91C1C", "#A16207", "#4D7C0F", "#9333EA", "#0E7490",
  "#C2410C", "#334155",
];

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const users = await db.user.findMany({
      orderBy: [{ role: "desc" }, { name: "asc" }], // admins first, then alphabetical
      include: { _count: { select: { logs: true } } },
    });
    return NextResponse.json({
      users: users.map((u) => ({ ...toPublicUser(u), logCount: u._count.logs })),
    });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const body = await readJson<{ name?: string; mobile?: string; role?: string; avatarColor?: string }>(req);

    const name = requireString(body.name, "نام و نام خانوادگی", { max: 60 });
    if (!isValidMobile(body.mobile)) {
      throw new ServerError("شماره موبایل معتبر نیست (مثال: 09123456789).", "validation");
    }
    const mobile = body.mobile!;
    const role = body.role === "admin" ? "admin" : "collaborator";

    const dup = await db.user.findUnique({ where: { mobile } });
    if (dup) throw new ServerError("کاربری با این شماره موبایل قبلاً ثبت شده است.", "validation");

    const avatarColor =
      typeof body.avatarColor === "string" && /^#[0-9A-Fa-f]{6}$/.test(body.avatarColor)
        ? body.avatarColor
        : AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const user = await db.user.create({ data: { name, mobile, role, avatarColor } });
    return NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
  });
}
