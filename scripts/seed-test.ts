/**
 * Deterministic test-data seeder (idempotent — wipes and re-creates).
 *
 * Users (fixed mobiles used by API + E2E tests):
 *   09120000001  سعید مدیر      admin   active
 *   09120000002  نگار مدیردوم   admin   active
 *   09121111111  مریم همکار     collaborator active
 *   09120000003  رضا غیرفعال    collaborator inactive
 *
 * Logs for مریم cover every status + one weekend "outside" log; all dates are
 * within the 3-day backdate window so business rules accept them.
 *
 * Run standalone:  DATABASE_URL=file:./db/test.db bun scripts/seed-test.ts
 * Or imported by tests/helpers/provision.ts (datasourceUrl override).
 */

import { PrismaClient } from "@prisma/client";
import { addDays, dateToJalali, isoDate, jalaliToDate, today } from "../src/lib/jalali";
import { DEFAULT_CALENDAR } from "../src/lib/default-calendar";
import { tehranTodayIso, tehranDaysAgoIso, computeOutsideKind } from "../src/lib/server/rules";

export const TEST_USERS = {
  admin: { name: "سعید مدیر", mobile: "09120000001", role: "admin" as const },
  admin2: { name: "نگار مدیردوم", mobile: "09120000002", role: "admin" as const },
  collab: { name: "مریم همکار", mobile: "09121111111", role: "collaborator" as const },
  inactive: { name: "رضا غیرفعال", mobile: "09120000003", role: "collaborator" as const },
};

export async function seedTestDb(db: PrismaClient): Promise<void> {
  await db.session.deleteMany();
  await db.otpSession.deleteMany();
  await db.timeLog.deleteMany();
  await db.holiday.deleteMany();
  await db.user.deleteMany();
  await db.calendarSettings.deleteMany();

  const users = await Promise.all(
    Object.values(TEST_USERS).map((u) =>
      db.user.create({
        data: { ...u, isActive: u !== TEST_USERS.inactive, avatarColor: u.role === "admin" ? "#0F766E" : "#B45309" },
      }),
    ),
  );
  const admin = users.find((u) => u.mobile === TEST_USERS.admin.mobile)!;
  const collab = users.find((u) => u.mobile === TEST_USERS.collab.mobile)!;

  // Holidays for the current + next Jalali year (fixed official list)
  const jy = dateToJalali(today()).jy;
  const items: [number, number, string][] = [
    [1, 1, "نوروز"], [1, 2, "عید نوروز"], [1, 3, "عید نوروز"], [1, 4, "عید نوروز"],
    [1, 12, "روز جمهوری اسلامی"], [1, 13, "جشن نوروز / روز طبیعت"],
    [3, 14, "رحلت امام خمینی"], [3, 15, "قیام ۱۵ خرداد"],
    [11, 22, "پیروزی انقلاب اسلامی"], [12, 29, "ملی شدن صنعت نفت"],
  ];
  const rows = [jy, jy + 1].flatMap((year) => items.map(([m, d, title]) => ({ date: isoDate(jalaliToDate(year, m, d)), title })));
  await db.holiday.createMany({ data: rows });

  await db.calendarSettings.create({
    data: { id: "main", workingDaysJson: JSON.stringify(DEFAULT_CALENDAR.workingDays), workingStartTime: DEFAULT_CALENDAR.workingStartTime, workingEndTime: DEFAULT_CALENDAR.workingEndTime },
  });

  const workingDays = DEFAULT_CALENDAR.workingDays;
  const holidays = new Set(rows.map((r) => r.date));
  // Most recent weekend (non-working, non-holiday) date, 1+ days ago:
  let weekendIso = "";
  for (let i = 1; i <= 7; i++) {
    const iso = tehranDaysAgoIso(i);
    if (computeOutsideKind(iso, workingDays, holidays) === "weekend") {
      weekendIso = iso;
      break;
    }
  }

  const mk = (workDate: string, description: string, minutes: number, status: string, opts: Partial<{ approved: number | null; note: string | null; reason: string | null; kind: string }> = {}) => ({
    userId: collab.id,
    workDate,
    description,
    originalDurationMinutes: minutes,
    approvedDurationMinutes: opts.approved ?? (status === "approved" ? minutes : status === "adjusted" ? (opts.approved ?? null) : null),
    status,
    outsideKind: opts.kind ?? computeOutsideKind(workDate, workingDays, holidays),
    adminNote: opts.note ?? null,
    rejectionReason: opts.reason ?? null,
    approvedBy: status === "pending" ? null : admin.id,
    approvedByName: status === "pending" ? null : admin.name,
    approvedAt: status === "pending" ? null : new Date(),
  });

  await db.timeLog.createMany({
    data: [
      mk(tehranTodayIso(), "گزارش تست امروز — توسعه API", 105, "pending"),
      mk(tehranTodayIso(), "جلسه تست امروز", 45, "approved"),
      mk(tehranDaysAgoIso(1), "رفع باگ تست دیروز", 120, "adjusted", { approved: 150, note: "۳۰ دقیقه اضافه‌کاری تأیید شد." }),
      mk(tehranDaysAgoIso(2), "گزارش تست ردشده", 60, "rejected", { reason: "شواهد کافی برای این زمان وجود ندارد." }),
      mk(tehranDaysAgoIso(3), "گزارش در انتظار قدیمی", 90, "pending"),
      ...(weekendIso ? [mk(weekendIso, "کار آخر هفته تست", 75, "pending", { kind: "weekend" })] : []),
      // one log owned by the admin himself (tests admin-owned log visibility)
      { userId: admin.id, workDate: tehranTodayIso(), description: "گزارش مدیر تست", originalDurationMinutes: 60, approvedDurationMinutes: null, status: "pending", outsideKind: "normal", adminNote: null, rejectionReason: null, approvedBy: null, approvedByName: null, approvedAt: null },
    ],
  });
}

/* ── standalone run ── (guard is import.meta-free so Playwright's CJS
   transpile of the tests can import this module safely) */
if (process.argv[1]?.endsWith("seed-test.ts")) {
  const url = process.env.DATABASE_URL ?? "file:/home/z/my-project/db/test.db";
  const db = new PrismaClient({ datasourceUrl: url });
  seedTestDb(db)
    .then(async () => {
      const [users, logs, holidays] = [await db.user.count(), await db.timeLog.count(), await db.holiday.count()];
      console.log("── test seed complete:", { users, logs, holidays });
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => db.$disconnect());
}
