/**
 * Session auth — cookie-backed sessions (httpOnly, SameSite=Lax).
 * Only sha256(token) is stored in the DB — a DB leak never yields
 * usable session cookies.
 */

import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { User } from "@/lib/types";
import { ServerError } from "./api-helpers";
import { CONFIG } from "./rules";

export const SESSION_COOKIE = "tt_session";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function toPublicUser(u: {
  id: string;
  name: string;
  mobile: string;
  role: string;
  isActive: boolean;
  avatarColor: string;
  avatarUrl?: string | null;
  managerId?: string | null;
  manager?: { name: string } | null;
}): User {
  return {
    id: u.id,
    name: u.name,
    mobile: u.mobile,
    role: u.role as User["role"],
    isActive: u.isActive,
    avatarColor: u.avatarColor,
    avatarUrl: u.avatarUrl ?? null,
    managerId: u.managerId ?? null,
    managerName: u.manager?.name ?? null,
  };
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + CONFIG.sessionTtlDays * 24 * 3600 * 1000);
  await db.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  // Opportunistic hygiene: drop expired sessions so the table stays small.
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
  return { token, expiresAt };
}

export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { include: { manager: { select: { name: true } } } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    void db.session.deleteMany({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (!session.user.isActive) return null;
  return toPublicUser(session.user);
}

/** Throws 401 if no valid session. */
export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw new ServerError("نشست شما منقضی شده است — دوباره وارد شوید.", "unauthorized");
  return user;
}

/** Throws 401/403 unless the caller is an active admin (مدیر ارشد). */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") throw new ServerError("این عملیات نیاز به دسترسی مدیر ارشد دارد.", "forbidden");
  return user;
}

/** Throws 401/403 unless the caller is a manager or the supreme admin. */
export async function requireManagerOrAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "manager") {
    throw new ServerError("این بخش فقط برای مدیران است.", "forbidden");
  }
  return user;
}

/** Throws 403 unless the caller is a manager — decisions belong to team managers only. */
export async function requireManager(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "manager") {
    throw new ServerError("تصمیم‌گیری (تأیید/رد/اصلاح) فقط توسط مدیر تیم امکان دارد.", "forbidden");
  }
  return user;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { id: hashToken(token) } });
  }
}

export const SESSION_COOKIE_OPTS = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  path: "/",
  maxAge: CONFIG.sessionTtlDays * 24 * 3600,
};
