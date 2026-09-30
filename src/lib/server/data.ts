/** Shared server data access — calendar singleton, holiday sets, log serialization. */

import { db } from "@/lib/db";
import { CalendarSettings, TimeLog, User } from "@/lib/types";
import { DEFAULT_CALENDAR } from "@/lib/default-calendar";
import { ServerError } from "./api-helpers";

/* ── Tiny TTL cache for read-heavy, rarely-changed data (calendar/holidays).
   Saves two DB round-trips on every log list/create/stat request. Invalidated
   explicitly by the settings routes when admins mutate them. */

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: unknown; expiresAt: number }>();

async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  const value = await loader();
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

/** Drop cached calendar/holidays after an admin mutation. */
export function invalidateCalendarCache(): void {
  cache.delete("calendar");
  cache.delete("holidays");
}

export async function getCalendar(): Promise<CalendarSettings> {
  return cached("calendar", async () => {
    const row = await db.calendarSettings.findUnique({ where: { id: "main" } });
    if (!row) {
      await db.calendarSettings.create({ data: { id: "main" } });
      return { ...DEFAULT_CALENDAR };
    }
    let workingDays: number[] = DEFAULT_CALENDAR.workingDays;
    try {
      const parsed = JSON.parse(row.workingDaysJson);
      if (Array.isArray(parsed)) workingDays = parsed.filter((n) => typeof n === "number");
    } catch {
      /* keep default */
    }
    return {
      workingDays,
      workingStartTime: row.workingStartTime,
      workingEndTime: row.workingEndTime,
    };
  });
}

export async function getHolidayDates(): Promise<Set<string>> {
  return cached("holidays", async () => {
    const rows = await db.holiday.findMany({ select: { date: true } });
    return new Set(rows.map((r) => r.date));
  });
}

/** Prisma TimeLog → client contract (ISO strings for dates). */
export function serializeLog(l: {
  id: string;
  userId: string;
  workDate: string;
  description: string;
  originalDurationMinutes: number;
  approvedDurationMinutes: number | null;
  status: string;
  outsideKind: string;
  adminNote: string | null;
  rejectionReason: string | null;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): TimeLog {
  return {
    id: l.id,
    userId: l.userId,
    workDate: l.workDate,
    description: l.description,
    originalDurationMinutes: l.originalDurationMinutes,
    approvedDurationMinutes: l.approvedDurationMinutes,
    status: l.status as TimeLog["status"],
    outsideKind: l.outsideKind as TimeLog["outsideKind"],
    adminNote: l.adminNote,
    rejectionReason: l.rejectionReason,
    approvedBy: l.approvedBy,
    approvedByName: l.approvedByName,
    approvedAt: l.approvedAt ? l.approvedAt.toISOString() : null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

export function serializeUser(u: {
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

export function logOrderBy(sortWorkDateDesc = true) {
  return sortWorkDateDesc
    ? [{ workDate: "desc" as const }, { createdAt: "desc" as const }]
    : [{ workDate: "asc" as const }, { createdAt: "asc" as const }];
}

/* ── Team scoping (hierarchy) ─────────────────────────────────
   admin (مدیر ارشد) sees everything; a manager only their own
   collaborators. Returns null = unrestricted, or the visible
   collaborator ids to build `userId: { in: ids }` filters. */

export function teamUserIdsCacheKey(user: User): string {
  return user.role === "admin" ? "all" : `mgr:${user.id}`;
}

/** Visible collaborator ids for the actor — null means unrestricted (admin). */
export async function teamUserIds(user: User): Promise<string[] | null> {
  if (user.role === "admin") return null;
  const members = await db.user.findMany({ where: { managerId: user.id }, select: { id: true } });
  return members.map((m) => m.id);
}

/** Log-level visibility filter for the actor. */
export async function logScope(user: User): Promise<{ userId?: { in: string[] } }> {
  const ids = await teamUserIds(user);
  return ids === null ? {} : { userId: { in: ids } };
}

/** Throws when a manager tries to touch a collaborator outside their team. */
export async function assertTeamMember(actor: User, collaboratorId: string): Promise<void> {
  if (actor.role === "admin") return;
  const target = await db.user.findUnique({ where: { id: collaboratorId }, select: { managerId: true } });
  if (!target || target.managerId !== actor.id) {
    throw new ServerError("این همکار تحت مدیریت شما نیست.", "forbidden");
  }
}
