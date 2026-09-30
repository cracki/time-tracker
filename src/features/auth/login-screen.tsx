"use client";

/**
 * Login (spec §4/§76) — phone + numeric keyboard, demo quick-fill chips,
 * error state for unknown numbers.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toLatinDigits, toPersianDigits } from "@/lib/format";
import { DEMO_MODE } from "@/lib/demo-mode";
import { useRouter } from "@/navigation/router";

export function LoginScreen({ onSendCode }: { onSendCode: (phone: string) => void }) {
  const { navigate } = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const valid = /^09\d{9}$/.test(phone);

  const submit = async () => {
    if (!valid) {
      setError("شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      onSendCode(phone);
    } finally {
      setLoading(false);
    }
  };

  // Demo accounts (seeded by scripts/seed.ts) — quick-fill chips for the demo deployment.
  const demoAdmin = { name: "علی رضایی", mobile: "09121000000" };
  const demoCollab = { name: "مریم احمدی", mobile: "09121111111" };
  const demoMode = DEMO_MODE;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="flex flex-1 flex-col justify-center px-6 pb-10 pt-16">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="mx-auto w-full max-w-sm"
        >
          {/* Brand */}
          <div className="mb-10 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="لوگوی زمان‌سنج"
              className="mx-auto mb-4 size-24 app-shadow"
              aria-hidden
            />
            <h1 className="text-2xl font-extrabold">زمان‌سنج</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              ثبت سریع زمان کاری، بدون معطلی
            </p>
          </div>

          <label htmlFor="phone" className="mb-2 block text-sm font-semibold">
            شماره موبایل
          </label>
          <div className="relative">
            <Input
              id="phone"
              inputMode="numeric"
              autoComplete="tel"
              dir="ltr"
              placeholder="0912 345 6789"
              className="h-14 rounded-2xl border-input bg-card text-center text-lg font-bold tracking-[0.2em] nums"
              value={toPersianDigits(phone)}
              onChange={(e) => {
                const d = toLatinDigits(e.target.value).replace(/\D/g, "").slice(0, 11);
                setPhone(d);
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              aria-invalid={!!error}
            />
          </div>
          {error ? (
            <p className="mt-2 text-xs font-medium text-danger" role="alert">{error}</p>
          ) : null}

          <Button
            onClick={submit}
            disabled={loading}
            className="mt-4 h-14 w-full rounded-2xl text-base font-bold shadow-lg shadow-primary/25 transition-transform active:scale-[0.98]"
          >
            {loading ? "در حال ارسال کد…" : "دریافت کد تأیید"}
            {!loading ? <ArrowLeft className="size-4.5" aria-hidden /> : null}
          </Button>

          {/* Demo accounts — quick-fill chips (only when NEXT_PUBLIC_DEMO_MODE=1) */}
          {demoMode ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-muted/40 p-4">
            <p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <Info className="size-3.5" aria-hidden />
              حساب‌های نمونه (نسخه نمایشی)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPhone(demoAdmin.mobile)}
                className="min-h-11 rounded-xl border bg-card px-3 py-2 text-right transition-colors hover:border-primary/50"
              >
                <span className="block text-xs font-bold">مدیر</span>
                <span className="block text-[11px] text-muted-foreground nums" dir="ltr">{toPersianDigits(demoAdmin.mobile)}</span>
              </button>
              <button
                type="button"
                onClick={() => setPhone(demoCollab.mobile)}
                className="min-h-11 rounded-xl border bg-card px-3 py-2 text-right transition-colors hover:border-primary/50"
              >
                <span className="block text-xs font-bold">همکار</span>
                <span className="block text-[11px] text-muted-foreground nums" dir="ltr">{toPersianDigits(demoCollab.mobile)}</span>
              </button>
            </div>
          </div>
          ) : null}
        </motion.div>
      </div>

      <button
        type="button"
        onClick={() => navigate("/about")}
        className="pb-6 text-center text-xs text-muted-foreground/70 hover:text-muted-foreground"
      >
        درباره زمان‌سنج
      </button>
    </div>
  );
}
