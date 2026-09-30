/** Shared server data access — calendar singleton, holiday sets, log serialization. */

import { db } from "@/lib/db";
import { CalendarSettings, TimeLog, User } from "@/lib/types";
import { DEFAULT_CALENDAR } from "@/lib/default-calendar";

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
}): User {
  return {
    id: u.id,
    name: u.name,
    mobile: u.mobile,
    role: u.role as User["role"],
    isActive: u.isActive,
    avatarColor: u.avatarColor,
    avatarUrl: u.avatarUrl ?? null,
  };
}

export function logOrderBy(sortWorkDateDesc = true) {
  return sortWorkDateDesc
    ? [{ workDate: "desc" as const }, { createdAt: "desc" as const }]
    : [{ workDate: "asc" as const }, { createdAt: "asc" as const }];
}
