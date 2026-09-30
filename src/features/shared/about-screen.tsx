"use client";

/**
 * About (درباره زمان‌سنج) — reachable from the login footer and from the
 * Account screen's app-version row. Works for guests and signed-in users.
 */

import {
  BarChart3, Check, Clock3, Download, FileCheck2, ShieldCheck, Smartphone, UserRoundCheck, WifiOff,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { APP_VERSION } from "@/lib/app-version";
import { toPersianDigits } from "@/lib/format";

const FEATURES: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }[] = [
  {
    icon: Clock3,
    title: "ثبت سریع زمان",
    text: "ثبت گزارش کاری با فرمت ساده‌ی ساعت:دقیقه، کیبورد عددی و تشخیص خودکار خارج از ساعت اداری و تعطیلات.",
  },
  {
    icon: UserRoundCheck,
    title: "تأیید تیمی",
    text: "مدیر زمان‌ها را بررسی و تأیید، اصلاح یا رد می‌کند؛ زمان اصلی و نهایی جداگانه نگه‌داری می‌شود.",
  },
  {
    icon: BarChart3,
    title: "داشبورد و گزارش",
    text: "نمودار روند روزانه، بیشترین زمان افراد، خارج از ساعت اداری و گزارش چاپی با تقویم جلالی.",
  },
  {
    icon: ShieldCheck,
    title: "مدیریت کاربران",
    text: "ایجاد و ویرایش کاربران، نقش مدیر/همکار و آواتار شخصی با بهینه‌سازی خودکار تصویر.",
  },
  {
    icon: WifiOff,
    title: "کار بدون اینترنت",
    text: "در نبود اینترنت، گزارش‌ها به‌صورت پیش‌نویس ذخیره و بعداً خودکار ارسال می‌شوند.",
  },
  {
    icon: Smartphone,
    title: "نصب روی گوشی (PWA)",
    text: "زمان‌سنج مثل یک اپلیکیشن روی گوشی نصب می‌شود؛ سبک، سریع و فارسی.",
  },
  {
    icon: FileCheck2,
    title: "ورود امن با کد پیامکی",
    text: "ورود بدون رمز عبور با کد یک‌بارمصرف، همراه با محدودیت تلاش و انقضای کد.",
  },
];

export function AboutScreen() {
  return (
    <div>
      <PageHeader title="درباره زمان‌سنج" back />

      <div className="mx-auto max-w-xl space-y-4 pb-8">
        {/* Brand */}
        <section className="rounded-2xl border bg-card p-6 text-center app-shadow">
          { }
          <img src="/logo.png" alt="" aria-hidden className="mx-auto mb-3 size-20 app-shadow" />
          <h2 className="text-xl font-extrabold">زمان‌سنج</h2>
          <p className="mt-1 text-xs text-muted-foreground nums" dir="ltr">
            نسخه {toPersianDigits(APP_VERSION)}
          </p>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            وب‌اپلیکیشن سبک ثبت، بررسی و تأیید زمان کاری تیم — موبایل‌اول، فارسی و سازگار با تقویم جلالی.
          </p>
        </section>

        {/* Features */}
        <section className="rounded-2xl border bg-card p-4 app-shadow">
          <p className="mb-3 text-sm font-bold">امکانات</p>
          <ul className="space-y-2.5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3 rounded-xl bg-muted/40 p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="size-4.5" aria-hidden />
                </span>
                <span>
                  <span className="block text-[13px] font-bold">{f.title}</span>
                  <span className="mt-0.5 block text-xs leading-6 text-muted-foreground">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Install hint */}
        <section className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-accent/50 p-4">
          <Download className="size-5 shrink-0 text-primary" aria-hidden />
          <p className="text-xs leading-6 text-accent-foreground">
            برای تجربه‌ی بهتر، زمان‌سنج را از منوی مرورگر («Add to Home Screen») روی گوشی خود نصب کنید.
          </p>
        </section>

        {/* Credits */}
        <section className="rounded-2xl border bg-card px-4 py-3 app-shadow">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">توسعه‌دهنده</span>
            <span className="flex items-center gap-1.5 text-sm font-extrabold">
              <Check className="size-4 text-success" aria-hidden />
              کامل کیمیایی فرد
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
