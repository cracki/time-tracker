"use client";

/**
 * OTP screen (spec §4) — 5-digit input with paste support, countdown,
 * resend cooldown, invalid / expired / too-many-attempts states.
 * Dev mode: the server returns devCode which is shown in the hint box;
 * once SMS is connected the box disappears (devCode absent).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, KeyRound, RefreshCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot,
} from "@/components/ui/input-otp";
import { authApi, ApiError } from "@/lib/api";
import { toLatinDigits, toPersianDigits } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "@/navigation/router";
import { toast } from "sonner";

export function OtpScreen({
  phone,
  devCode,
  expiresAt,
  onBack,
  onResent,
}: {
  phone: string;
  /** Present only in dev mode (no SMS gateway connected). */
  devCode?: string;
  expiresAt: number;
  onBack: () => void;
  onResent: (info: { devCode?: string; expiresAt: number }) => void;
}) {
  const { signIn } = useAuth();
  const { navigate } = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(30);
  const [now, setNow] = useState(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      setResendIn((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const secondsLeft = useMemo(() => Math.max(0, Math.ceil((expiresAt - now) / 1000)), [expiresAt, now]);
  const expired = secondsLeft === 0;

  useEffect(() => {
    // Focus the real OTP input (inside the wrapper) so the mobile keyboard
    // opens immediately; fall back to the wrapper for desktop tests.
    const input = containerRef.current?.querySelector("input");
    (input ?? containerRef.current)?.focus();
  }, []);

  const verify = async (value: string) => {
    setLoading(true);
    setError(null);
    try {
      const user = await authApi.verifyOtp(phone, toLatinDigits(value));
      signIn(user);
      toast.success(`خوش آمدید، ${user.name}!`);
      navigate("/home", { replace: true });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "خطایی رخ داد. دوباره تلاش کنید.";
      setError(msg);
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (v: string) => {
    const d = toLatinDigits(v).replace(/\D/g, "").slice(0, 5);
    setCode(d);
    setError(null);
    if (d.length === 5 && !loading) void verify(d);
  };

  const resend = async () => {
    try {
      const info = await authApi.requestOtp(phone);
      onResent(info);
      setResendIn(30);
      setCode("");
      setError(null);
      toast.success("کد جدید ارسال شد.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ارسال مجدد ناموفق بود.");
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="px-2 pt-4">
        <button
          onClick={onBack}
          aria-label="تغییر شماره"
          className="flex size-11 items-center justify-center rounded-full text-foreground hover:bg-muted"
        >
          <ArrowRight className="size-5" aria-hidden />
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="mx-auto w-full max-w-sm flex-1 px-6"
      >
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex size-16 items-center justify-center rounded-3xl bg-accent text-accent-foreground">
            <ShieldCheck className="size-7" aria-hidden />
          </span>
          <h1 className="text-xl font-extrabold">کد تأیید را وارد کنید</h1>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            کد ۵ رقمی به شماره{" "}
            <span className="font-bold nums" dir="ltr">{toPersianDigits(phone)}</span>{" "}
            ارسال شد
          </p>
        </div>

        {/* Dev-mode hint — the server includes devCode until SMS is connected */}
        {devCode ? (
          <div className="mb-5 flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-accent/60 px-3 py-2.5 text-xs font-semibold text-accent-foreground">
            <KeyRound className="size-4 shrink-0" aria-hidden />
            کد تأیید (حالت توسعه): <span className="nums text-base tracking-widest" dir="ltr">{toPersianDigits(devCode)}</span>
          </div>
        ) : null}

        {/* dir=ltr: OTP is numeric — digits must fill left→right like math,
            regardless of the RTL page. (input-otp only forwards `dir` to its
            hidden input, so the visual slots need it on an ancestor.) */}
        <div className="flex justify-center" dir="ltr" ref={containerRef} tabIndex={-1}>
          <InputOTP
            maxLength={5}
            value={code}
            onChange={handleChange}
            disabled={loading || expired}
            dir="ltr"
            containerClassName="justify-center gap-2"
          >
            <InputOTPGroup className="gap-2">
              {[0, 1, 2].map((i) => (
                <InputOTPSlot key={i} index={i} className="size-13 rounded-2xl border-input bg-card text-xl font-bold" />
              ))}
            </InputOTPGroup>
            <InputOTPGroup className="gap-2">
              {[3, 4].map((i) => (
                <InputOTPSlot key={i} index={i} className="size-13 rounded-2xl border-input bg-card text-xl font-bold" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {error ? (
          <p className="mt-4 text-center text-sm font-medium text-danger" role="alert">{error}</p>
        ) : null}

        {expired && !error ? (
          <p className="mt-4 text-center text-sm font-medium text-warning">کد منقضی شد — کد جدید بگیرید.</p>
        ) : null}

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {!expired && secondsLeft > 0 ? (
            <p>
              انقضای کد تا <span className="font-bold text-foreground nums">{toPersianDigits(secondsLeft)}</span> ثانیه
            </p>
          ) : null}
          <div className="mt-3">
            {resendIn > 0 ? (
              <p className="nums">ارسال مجدد تا {toPersianDigits(resendIn)} ثانیه دیگر</p>
            ) : (
              <Button variant="ghost" onClick={resend} className="min-h-11 gap-1.5 text-sm font-bold text-primary">
                <RefreshCcw className="size-4" aria-hidden />
                ارسال مجدد کد
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
