/**
 * GET /api/admin/report/export?from&to&tab — real printable report (spec §29).
 *
 * Builds a self-contained, print-optimized HTML document (RTL, embedded
 * Vazirmatn) directly from live database data. The client renders it in a
 * hidden iframe and triggers the browser print dialog — "Save as PDF"
 * produces the final file. Works identically on desktop and mobile.
 */

import { readFileSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, ServerError } from "@/lib/server/api-helpers";
import { requireAdmin } from "@/lib/server/auth";
import { serializeLog } from "@/lib/server/data";
import { formatJalali } from "@/lib/jalali";
import { minutesToHHMM } from "@/lib/duration";
import { toPersianDigits } from "@/lib/format";

/* ── Embedded fonts (cached at module level) ────────────────── */

let fontsCss: string | null = null;

function getFontsCss(): string {
  if (fontsCss) return fontsCss;
  const dir = path.join(process.cwd(), "node_modules", "vazirmatn", "fonts", "webfonts");
  const embed = (file: string) =>
    readFileSync(path.join(dir, file)).toString("base64");
  const regular = embed("Vazirmatn-Regular.woff2");
  const bold = embed("Vazirmatn-Bold.woff2");
  fontsCss = `
    @font-face { font-family: "Vazirmatn"; font-weight: 400; src: url(data:font/woff2;base64,${regular}) format("woff2"); }
    @font-face { font-family: "Vazirmatn"; font-weight: 700; src: url(data:font/woff2;base64,${bold}) format("woff2"); }
  `;
  return fontsCss;
}

/* ── Helpers ────────────────────────────────────────────────── */

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

const KIND_LABEL: Record<string, string> = {
  outside: "خارج از ساعت اداری",
  holiday: "تعطیل رسمی",
  weekend: "آخر هفته",
};

function page(opts: { title: string; rangeText: string; body: string }): string {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<style>
${getFontsCss()}
* { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: A4; margin: 14mm 12mm; }
html, body { background: #fff; }
body {
  font-family: "Vazirmatn", Tahoma, sans-serif;
  color: #111827; font-size: 12px; line-height: 1.9;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
  padding: 24px;
}
.doc-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
  border-bottom: 2px solid #0f766e; padding-bottom: 12px; margin-bottom: 6px; }
.brand { display: flex; align-items: center; gap: 10px; }
.brand-mark { width: 40px; height: 40px; border-radius: 12px; background: #0f766e; color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; }
h1 { font-size: 17px; font-weight: 700; color: #0f172a; }
.meta { font-size: 11px; color: #475569; }
.range-line { font-size: 12.5px; font-weight: 700; color: #0f766e; margin-bottom: 16px; }
table { width: 100%; border-collapse: collapse; margin-top: 8px; }
th, td { border: 1px solid #e2e8f0; padding: 7px 10px; text-align: right; vertical-align: top; }
th { background: #f0fdfa; color: #134e4a; font-weight: 700; font-size: 11.5px; }
tr:nth-child(even) td { background: #f8fafc; }
td.num, th.num { text-align: left; direction: ltr; font-variant-numeric: tabular-nums; }
tr.total td { background: #ecfdf5 !important; font-weight: 700; border-top: 2px solid #0f766e; }
.pill { display: inline-block; border-radius: 999px; padding: 0 8px; font-size: 10.5px;
  background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa; }
.note { margin-top: 4px; font-size: 10.5px; color: #64748b; }
.doc-footer { margin-top: 22px; padding-top: 10px; border-top: 1px solid #e2e8f0;
  font-size: 10.5px; color: #94a3b8; display: flex; justify-content: space-between; }
h2.section { font-size: 13.5px; font-weight: 700; color: #0f172a; margin: 18px 0 2px; }
.desc { color: #475569; font-size: 11px; }
@media print { body { padding: 0; } }
</style>
</head>
<body>
  <header class="doc-header">
    <div class="brand">
      <span class="brand-mark">ز</span>
      <div>
        <h1>${esc(opts.title)}</h1>
        <div class="meta">اپلیکیشن مدیریت زمان «زمان‌سنج»</div>
      </div>
    </div>
    <div class="meta">
      تاریخ تولید: ${formatJalali(new Date(), "long")}
    </div>
  </header>
  <p class="range-line">بازه گزارش: ${esc(opts.rangeText)}</p>
  ${opts.body}
  <footer class="doc-footer">
    <span>تولیدشده توسط زمان‌سنج — سمت مدیریت</span>
  </footer>
</body>
</html>`;
}

/* ── Handler ────────────────────────────────────────────────── */

export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();

    const url = new URL(req.url);
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    const tab = url.searchParams.get("tab") === "outside" ? "outside" : "time";
    if (!ISO_RE.test(from) || !ISO_RE.test(to)) {
      throw new ServerError("بازه گزارش نامعتبر است.", "validation");
    }

    const dateWhere = { workDate: { gte: from, lte: to } };
    const rangeText = `از ${formatJalali(from, "long")} تا ${formatJalali(to, "long")}`;

    const users = await db.user.findMany({ where: { role: "collaborator" } });
    const logs = await db.timeLog.findMany({ where: dateWhere, orderBy: [{ workDate: "asc" }, { createdAt: "asc" }] });

    let title: string;
    let body: string;

    if (tab === "time") {
      title = "گزارش زمان تیم";
      const rows = users
        .map((u) => {
          const mine = logs.filter((l) => l.userId === u.id);
          return {
            user: u,
            logged: mine.reduce((s, l) => s + l.originalDurationMinutes, 0),
            approved: mine.reduce((s, l) => s + (l.approvedDurationMinutes ?? 0), 0),
            count: mine.length,
          };
        })
        .filter((r) => r.count > 0)
        .sort((a, b) => b.logged - a.logged);

      const totalLogged = rows.reduce((s, r) => s + r.logged, 0);
      const totalApproved = rows.reduce((s, r) => s + r.approved, 0);

      body = `
<table>
  <thead><tr>
    <th style="width:44px">#</th><th>نام همکار</th><th>موبایل</th>
    <th class="num">ثبت‌شده</th><th class="num">تأییدشده</th><th class="num">اختلاف</th><th class="num">تعداد گزارش</th>
  </tr></thead>
  <tbody>
    ${rows
      .map(
        (r, i) => `<tr>
      <td class="num">${toPersianDigits(String(i + 1))}</td>
      <td>${esc(r.user.name)}${r.user.isActive ? "" : ' <span class="pill">غیرفعال</span>'}</td>
      <td class="num">${toPersianDigits(r.user.mobile)}</td>
      <td class="num">${minutesToHHMM(r.logged)}</td>
      <td class="num">${minutesToHHMM(r.approved)}</td>
      <td class="num">${minutesToHHMM(r.logged - r.approved)}</td>
      <td class="num">${toPersianDigits(String(r.count))}</td>
    </tr>`,
      )
      .join("")}
    <tr class="total">
      <td colspan="3">جمع کل (${toPersianDigits(String(rows.length))} نفر)</td>
      <td class="num">${minutesToHHMM(totalLogged)}</td>
      <td class="num">${minutesToHHMM(totalApproved)}</td>
      <td class="num">${minutesToHHMM(totalLogged - totalApproved)}</td>
      <td class="num">${toPersianDigits(String(logs.length))}</td>
    </tr>
  </tbody>
</table>
<p class="note">اختلاف = ثبت‌شده منهای تأییدشده (شامل گزارش‌های در انتظار تأیید و اصلاح‌شده).</p>`;
    } else {
      title = "گزارش خارج از ساعت اداری";
      const rows = users
        .map((u) => {
          const mine = logs.filter((l) => l.userId === u.id);
          const outsideLogs = mine.filter((l) => l.outsideKind !== "normal");
          return {
            user: u,
            outside: outsideLogs.reduce((s, l) => s + l.originalDurationMinutes, 0),
            total: mine.reduce((s, l) => s + l.originalDurationMinutes, 0),
            logs: outsideLogs.map(serializeLog),
          };
        })
        .filter((r) => r.outside > 0)
        .sort((a, b) => b.outside - a.outside);

      const grand = rows.reduce((s, r) => s + r.outside, 0);

      body = `
<table>
  <thead><tr>
    <th style="width:44px">#</th><th>نام همکار</th>
    <th class="num">خارج از ساعت اداری</th><th class="num">کل ثبت‌شده</th><th class="num">سهم</th><th class="num">تعداد</th>
  </tr></thead>
  <tbody>
    ${rows
      .map(
        (r, i) => `<tr>
      <td class="num">${toPersianDigits(String(i + 1))}</td>
      <td>${esc(r.user.name)}${r.user.isActive ? "" : ' <span class="pill">غیرفعال</span>'}</td>
      <td class="num">${minutesToHHMM(r.outside)}</td>
      <td class="num">${minutesToHHMM(r.total)}</td>
      <td class="num">${toPersianDigits(String(r.total > 0 ? Math.round((r.outside / r.total) * 100) : 0))}٪</td>
      <td class="num">${toPersianDigits(String(r.logs.length))}</td>
    </tr>`,
      )
      .join("")}
    <tr class="total">
      <td colspan="2">جمع کل (${toPersianDigits(String(rows.length))} نفر)</td>
      <td class="num">${minutesToHHMM(grand)}</td>
      <td colspan="3"></td>
    </tr>
  </tbody>
</table>`;

      if (rows.length > 0) {
        body += `<h2 class="section">جزئیات گزارش‌های خارج از ساعت اداری</h2>
<table>
  <thead><tr>
    <th>تاریخ</th><th>همکار</th><th>نوع روز</th><th class="num">مدت</th><th>شرح فعالیت</th>
  </tr></thead>
  <tbody>
    ${rows
      .flatMap((r) =>
        r.logs.map(
          (l) => `<tr>
        <td>${formatJalali(l.workDate, "short")}</td>
        <td>${esc(r.user.name)}</td>
        <td>${KIND_LABEL[l.outsideKind] ?? esc(l.outsideKind)}</td>
        <td class="num">${minutesToHHMM(l.originalDurationMinutes)}</td>
        <td class="desc">${esc(l.description)}</td>
      </tr>`,
        ),
      )
      .join("")}
  </tbody>
</table>`;
      } else {
        body += `<p class="note">در این بازه هیچ گزارشی خارج از ساعات کاری ثبت نشده است.</p>`;
      }
    }

    return new NextResponse(
      page({
        title,
        rangeText,
        body,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  });
}
