/**
 * Seed the SQLite database with the hierarchical demo dataset:
 *   1 مدیر ارشد (admin, view-only) → 3 مدیر (team managers) → 12 همکار
 *   (~50 days of logs, official holidays current + next Jalali year,
 *   default calendar). Idempotent: wipes and re-creates demo data.
 *
 * Run: npx tsx scripts/seed.ts   (or: bun scripts/seed.ts)
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
    t = (t + Math.imul(t ^ (t >>> 14), 1 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(1405);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));

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

/** Team structure: مدیر ارشد → 3 مدیر → 4 همکار each */
const HIERARCHY = {
  admin: { name: "علی رضایی", mobile: "09121000000" },
  managers: [
    { name: "مریم احمدی", mobile: "09122000001" },
    { name: "رضا محمدی", mobile: "09122000002" },
    { name: "سارا کریمی", mobile: "09122000003" },
  ],
  collaborators: [
    "حسین موسوی", "نگار حسینی", "امیر تهرانی", "زهرا نوری",
    "محمد قاسمی", "فاطمه صادقی", "پویا اکبری", "الهام رستمی",
    "سعید مرادی", "نازنین شریفی", "کامران فرهادی", "شیرین عباسی",
  ].map((name, i) => ({ name, mobile: `091230${String(1 + i).padStart(5, "0")}` })),
};

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
  // self-relation: clear children's managerId first
  await db.user.updateMany({ data: { managerId: null } });
  await db.user.deleteMany();
  await db.calendarSettings.deleteMany();

  console.log("── seeding: hierarchy (1 admin · 3 managers · 12 collaborators)");
  const admin = await db.user.create({
    data: { ...HIERARCHY.admin, role: "admin", isActive: true, avatarColor: AVATAR_COLORS[0] },
  });

  const managers: { id: string; name: string }[] = [];
  for (let i = 0; i < HIERARCHY.managers.length; i++) {
    const m = HIERARCHY.managers[i];
    managers.push(
      await db.user.create({
        data: { ...m, role: "manager", isActive: true, avatarColor: AVATAR_COLORS[(i + 1) % AVATAR_COLORS.length] },
      }),
    );
  }

  const collaborators: { id: string; managerId: string | null }[] = [];
  for (let i = 0; i < HIERARCHY.collaborators.length; i++) {
    const c = HIERARCHY.collaborators[i];
    const manager = managers[i % managers.length];
    collaborators.push(
      await db.user.create({
        data: {
          ...c,
          role: "collaborator",
          isActive: true,
          avatarColor: AVATAR_COLORS[(i + 4) % AVATAR_COLORS.length],
          managerId: manager.id,
        },
      }),
    );
  }

  console.log("── seeding: holidays + calendar");
  const jy = dateToJalali(today()).jy;
  const holidayRows = [...holidaysForYear(jy), ...holidaysForYear(jy + 1)];
  await db.holiday.createMany({ data: holidayRows });
  await db.calendarSettings.create({
    data: { id: "main", workingDaysJson: "[0,1,2,3]", workingStartTime: "08:00", workingEndTime: "17:00" },
  });

  console.log("── seeding: logs (~50 days, approved by team managers)");
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

  collaborators.forEach((user) => {
    const reviewer = managers.find((m) => m.id === user.managerId) ?? managers[0];
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
          approvedBy: needsReview ? reviewer.id : null,
          approvedByName: needsReview ? reviewer.name : null,
          approvedAt,
          createdAt,
          updatedAt: approvedAt ?? createdAt,
        });
      }
    }
  });

  // guarantee fresh pending content for the primary demo collaborator (حسین موسوی —
  // first collaborator of the first manager, مریم احمدی)
  const demo = collaborators[0];
  const demoManager = managers[0];
  const mk = (d: number, desc: string, min: number, status: string, kind = "normal") => {
    const date = addDays(t, -d);
    const createdAt = new Date(date);
    createdAt.setHours(between(9, 20), 30, 0, 0);
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
      approvedBy: needsReview ? demoManager.id : null,
      approvedByName: needsReview ? demoManager.name : null,
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
    teams: await db.user.groupBy({ by: ["managerId"], where: { role: "collaborator" }, _count: true }),
  };
  console.log("── seed complete:", JSON.stringify(counts));
  console.log(`   admin: ${HIERARCHY.admin.mobile} · managers: ${HIERARCHY.managers.map((m) => m.mobile).join(", ")} · collab: ${HIERARCHY.collaborators[0].mobile}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
