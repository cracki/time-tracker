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
import { ThemeToggle } from "@/components/shared/app-shell";
import { OrbitLogo } from "@/components/shared/orbit-logo";

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
  const demoManager = { name: "مریم احمدی", mobile: "09122000001" };
  const demoCollab = { name: "حسین موسوی", mobile: "09123000001" };
  const demoMode = DEMO_MODE;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Theme toggle — top corner */}
      <div className="fixed left-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <div className="flex flex-1 flex-col justify-center px-6 pb-10 pt-16">
        <motion.div
          variants={STAGGER}
          initial="hidden"
          animate="show"
          className="mx-auto w-full max-w-sm"
        >
          {/* Brand */}
          <motion.div variants={RISE} className="mb-8 text-center">
            <OrbitLogo size={104} className="mx-auto mb-4" />
            <h1 className="text-2xl font-extrabold">زمان‌سنج</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              ثبت سریع زمان کاری، بدون معطلی
            </p>
          </motion.div>

          {/* Glass form panel */}
          <motion.div variants={RISE} className="glass-panel p-5">
            <label htmlFor="phone" className="mb-2 block text-sm font-semibold">
              شماره موبایل
            </label>
            <div className="relative">
              <Input
                id="phone"
                inputMode="numeric"
                autoComplete="tel"
                autoFocus
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
              className="mt-4 h-14 w-full rounded-2xl text-base font-bold shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98]"
            >
              {loading ? "در حال ارسال کد…" : "دریافت کد تأیید"}
              {!loading ? <ArrowLeft className="size-4.5" aria-hidden /> : null}
            </Button>

            {/* Demo accounts — quick-fill chips (only when NEXT_PUBLIC_DEMO_MODE=1) */}
            {demoMode ? (
              <div className="mt-5 rounded-2xl border border-dashed border-border bg-muted/40 p-4">
                <p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <Info className="size-3.5" aria-hidden />
                  حساب‌های نمونه (نسخه نمایشی)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "مدیر ارشد", mobile: demoAdmin.mobile },
                    { label: "مدیر", mobile: demoManager.mobile },
                    { label: "همکار", mobile: demoCollab.mobile },
                  ].map((d) => (
                    <button
                      key={d.label}
                      type="button"
                      onClick={() => setPhone(d.mobile)}
                      className="min-h-11 rounded-xl border bg-card px-2 py-2 text-center transition-colors hover:border-primary/50"
                    >
                      <span className="block text-[11px] font-bold">{d.label}</span>
                      <span className="block text-[10px] text-muted-foreground nums" dir="ltr">{toPersianDigits(d.mobile)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      </div>

      <motion.button
        variants={FADE}
        initial="hidden"
        animate="show"
        type="button"
        onClick={() => navigate("/about")}
        className="pb-6 text-center text-xs text-muted-foreground/70 hover:text-muted-foreground"
      >
        درباره زمان‌سنج
      </motion.button>
    </div>
  );
}

/* Entrance choreography — staggered rise-and-fade */
const STAGGER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};
const RISE = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};
const FADE = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.6 } },
};
