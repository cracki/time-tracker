/**
 * Seed the SQLite database with the demo dataset (mirrors the prototype
 * mock-db seed, spec §77): 22 users (2 admins), ~50 days of logs,
 * official holidays (current + next Jalali year), default calendar.
 *
 * Run: bunx tsx scripts/seed.ts   (or: bun scripts/seed.ts)
 * Idempotent: wipes and re-creates demo data.
 */

import { PrismaClient } from "@prisma/client";
import { addDays, dateToJalali, isoDate, isWeekend, jalaliToDate, today } from "../src/lib/jalali";

const db = new PrismaClient();

/* seeded RNG (mulberry32) — same seed as the prototype for identical demo data */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(1405);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));

const NAME_POOL = [
  "علی رضایی", "مریم احمدی", "رضا محمدی", "سارا کریمی", "حسین موسوی",
  "نگار حسینی", "امیر تهرانی", "زهرا نوری", "محمد قاسمی", "فاطمه صادقی",
  "پویا اکبری", "الهام رستمی", "سعید مرادی", "نازنین شریفی", "کامران فرهادی",
  "شیرین عباسی", "بهرام کاظمی", "مینا یوسفی", "آرش سپهری", "لیلا جهانی",
  "فرزاد امینی", "هانیه سلطانی",
];

const AVATAR_COLORS = [
  "#0F766E", "#B45309", "#7C3AED", "#BE185D", "#15803D",
  "#B91C1C", "#A16207", "#4D7C0F", "#9333EA", "#0E7490",
  "#C2410C", "#334155",
];

const DESCRIPTIONS = [
  "توسعه API پرداخت", "رفع خطای Production", "جلسه داخلی تیم", "بررسی Pull Request",
  "طراحی صفحه داشبورد", "پیاده‌سازی احراز هویت", "بازنویسی ماژول گزارش", "تست و دیباگ سرویس پیامک",
  "رفاکتور کامپوننت‌های فرم", "مستندسازی API", "بررسی گزارش‌های سرور", "بهینه‌سازی کوئری‌ها",
  "پیاده‌سازی نوتیفیکیشن", "جلسه با تیم محصول", "طراحی دیتابیس گزارش‌ها", "رفع باگ صفحه ورود",
  "توسعه تقویم شمسی", "آپدیت وابستگی‌های پروژه", "کد ریویو هفتگی", "پیاده‌سازی گزارش PDF",
  "تنظیم CI/CD", "بررسی امنیت API", "توسعه ماژول تقویم کاری", "اصلاح محاسبه ساعت‌های خارج از اداری",
  "پاسخ به تیکت‌های پشتیبانی", "طراحی UI موبایل", "پیاده‌سازی حالت آفلاین", "بررسی عملکرد داشبورد",
];

function statusForAge(daysAgo: number): string {
  const r = rand();
  if (daysAgo <= 1) return r < 0.68 ? "pending" : "approved";
  if (daysAgo <= 3) {
    if (r < 0.3) return "pending";
    if (r < 0.75) return "approved";
    if (r < 0.9) return "adjusted";
    return "rejected";
  }
  if (r < 0.68) return "approved";
  if (r < 0.84) return "adjusted";
  if (r < 0.92) return "rejected";
  return "pending";
}

function holidaysForYear(jy: number): { date: string; title: string }[] {
  const items: [number, number, string][] = [
    [1, 1, "نوروز"], [1, 2, "عید نوروز"], [1, 3, "عید نوروز"], [1, 4, "عید نوروز"],
    [1, 12, "روز جمهوری اسلامی"], [1, 13, "جشن نوروز / روز طبیعت"],
    [3, 14, "رحلت امام خمینی"], [3, 15, "قیام ۱۵ خرداد"],
    [11, 22, "پیروزی انقلاب اسلامی"], [12, 29, "ملی شدن صنعت نفت"],
  ];
  return items.map(([m, d, title]) => ({ date: isoDate(jalaliToDate(jy, m, d)), title }));
}

async function main() {
  console.log("── seeding: wiping existing data");
  await db.session.deleteMany();
  await db.otpSession.deleteMany();
  await db.timeLog.deleteMany();
  await db.holiday.deleteMany();
  await db.user.deleteMany();
  await db.calendarSettings.deleteMany();

  console.log("── seeding: users (22, incl. 2 admins)");
  const ADMIN_IDX = new Set([0, 21]);
  const users = await Promise.all(
    NAME_POOL.map((name, i) =>
      db.user.create({
        data: {
          name,
          mobile: `0912${String(1000000 + i * 111111).slice(0, 7)}`,
          role: ADMIN_IDX.has(i) ? "admin" : "collaborator",
          isActive: true,
          avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
        },
      }),
    ),
  );
  const admins = users.filter((u) => u.role === "admin");

  console.log("── seeding: holidays + calendar");
  const jy = dateToJalali(today()).jy;
  const holidayRows = [...holidaysForYear(jy), ...holidaysForYear(jy + 1)];
  await db.holiday.createMany({ data: holidayRows });
  await db.calendarSettings.create({
    data: { id: "main", workingDaysJson: "[0,1,2,3]", workingStartTime: "08:00", workingEndTime: "17:00" },
  });

  console.log("── seeding: logs (~50 days)");
  const holidaySet = new Set(holidayRows.map((h) => h.date));
  const t = today();
  const DAYS = 50;
  const rows: {
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
  }[] = [];

  users.forEach((user, ui) => {
    for (let d = DAYS; d >= 0; d--) {
      const date = addDays(t, -d);
      const iso = isoDate(date);
      const kind = holidaySet.has(iso) ? "holiday" : isWeekend(date) ? "weekend" : rand() < 0.08 ? "outside" : "normal";
      const isOffDay = kind !== "normal";
      const chance = isOffDay ? 0.12 : 0.62;
      if (rand() > chance) continue;

      const count = between(1, 4);
      for (let i = 0; i < count; i++) {
        const status = statusForAge(d);
        const original = between(3, 16) * 15; // 45m … 4h
        const adjusted = status === "adjusted"
          ? Math.max(15, original + pick([-45, -30, -15, 15, 30, 45]))
          : status === "approved" ? original : null;
        const createdHour = kind === "normal" ? between(8, 21) : between(19, 23);
        const createdAt = new Date(date);
        createdAt.setHours(createdHour, between(0, 59), 0, 0);
        const needsReview = status === "approved" || status === "adjusted" || status === "rejected";
        const approvedAt = needsReview ? new Date(addDays(createdAt, between(0, 1))) : null;
        const approver = admins.find((a) => a.id !== user.id) ?? admins[0];
        rows.push({
          userId: user.id,
          workDate: iso,
          description: pick(DESCRIPTIONS),
          originalDurationMinutes: original,
          approvedDurationMinutes: adjusted,
          status,
          outsideKind: kind,
          adminNote: status === "adjusted" && rand() < 0.5
            ? pick(["بخشی از زمان اضافه‌کاری جداگانه محاسبه شد.", "زمان واقعی بر اساس گزارش Git اصلاح شد.", "با همکار هماهنگ شد."]).slice(0, 60)
            : null,
          rejectionReason: status === "rejected" && rand() < 0.6
            ? pick(["تکراری با گزارش قبلی بود.", "شواهد کافی برای این زمان وجود ندارد.", "توضیحات نامشخص است."])
            : null,
          approvedBy: needsReview ? approver.id : null,
          approvedByName: needsReview ? approver.name : null,
          approvedAt,
          createdAt,
          updatedAt: approvedAt ?? createdAt,
        });
      }
    }
  });

  // guarantee fresh content for the primary demo collaborator (مریم احمدی)
  const demo = users[1];
  const mk = (d: number, desc: string, min: number, status: string, kind = "normal") => {
    const date = addDays(t, -d);
    const createdAt = new Date(date);
    createdAt.setHours(between(9, 20), 30, 0, 0);
    const approver = admins[1] ?? admins[0];
    const needsReview = status !== "pending";
    return {
      userId: demo.id,
      workDate: isoDate(date),
      description: desc,
      originalDurationMinutes: min,
      approvedDurationMinutes: status === "approved" ? min : status === "adjusted" ? min + 30 : null,
      status,
      outsideKind: kind,
      adminNote: status === "adjusted" ? "۳۰ دقیقه اضافه‌کاری تأیید شد." : null,
      rejectionReason: status === "rejected" ? "این کار در گزارش روز قبل ثبت شده بود." : null,
      approvedBy: needsReview ? approver.id : null,
      approvedByName: needsReview ? approver.name : null,
      approvedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    };
  };
  rows.push(
    mk(0, "توسعه API پرداخت", 150, "pending"),
    mk(0, "جلسه داخلی تیم", 45, "approved"),
    mk(1, "رفع خطای Production", 80, "pending"),
    mk(1, "بررسی Pull Request", 70, "adjusted"),
    mk(2, "توسعه Production در شیفت شب", 90, "pending", "outside"),
  );

  await db.timeLog.createMany({ data: rows });

  const counts = {
    users: await db.user.count(),
    logs: await db.timeLog.count(),
    holidays: await db.holiday.count(),
    pending: await db.timeLog.count({ where: { status: "pending" } }),
  };
  console.log("── seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
