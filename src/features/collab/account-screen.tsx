"use client";

/**
 * Account (spec §76.12) — profile, theme, PWA install, offline drafts +
 * sync, offline simulation toggle, about.
 */

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  Camera, CloudUpload, Download, Info, LogOut, MoonStar, RefreshCcw, Smartphone, Sun, Moon, Trash2, WifiOff, Monitor,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { ConnectionPill, SyncStatusChip, useDraftSync } from "@/components/shared/offline-banner";
import { UserAvatar } from "@/components/shared/time-log-card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { authApi, draftApi, ApiError } from "@/lib/api";
import { DEMO_MODE } from "@/lib/demo-mode";
import { setSimOffline } from "@/lib/sim-offline";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "@/navigation/router";
import { formatJalali, today } from "@/lib/jalali";
import { minutesToHHMM } from "@/lib/duration";
import { toPersianDigits } from "@/lib/format";
import { APP_VERSION } from "@/lib/app-version";
import { relativeDayLabel } from "@/lib/jalali";
import { usePwaInstaller } from "@/components/shared/app-shell";
import { cn } from "@/lib/utils";

export function AccountScreen() {
  const { user, signOut, updateUser } = useAuth();
  const { navigate } = useRouter();
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();
  const { count, syncing, sync, refresh: refreshDrafts } = useDraftSync();
  const { canInstall, install } = usePwaInstaller();
  const [sim, setSim] = useState<boolean>(
    () => typeof document !== "undefined" && document.documentElement.dataset.simOffline === "1",
  );
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: drafts } = useQuery({
    queryKey: ["drafts"],
    queryFn: () => draftApi.listDrafts(),
  });

  useEffect(() => {
    document.documentElement.dataset.simOffline = sim ? "1" : "0";
    setSimOffline(sim);
  }, [sim]);

  const THEMES = [
    { key: "light", label: "روشن", icon: Sun },
    { key: "dark", label: "تاریک", icon: Moon },
    { key: "system", label: "سیستم", icon: Monitor },
  ];

  const syncNow = async () => {
    await sync();
    await refreshDrafts();
    void qc.invalidateQueries({ queryKey: ["drafts"] });
  };

  const removeDraft = async (id: string) => {
    await draftApi.removeDraft(id);
    void qc.invalidateQueries({ queryKey: ["drafts"] });
    toast.info("پیش‌نویس حذف شد.");
  };

  /** Validate ≤5MB image, upload, and mirror the new avatarUrl into the session user. */
  const onPickAvatar = (file: File | undefined) => {
    if (!file || uploadingAvatar) return;
    if (!file.type.startsWith("image/")) {
      toast.error("فقط فایل تصویری قابل قبول است.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم تصویر باید حداکثر ۵ مگابایت باشد.");
      return;
    }
    setUploadingAvatar(true);
    authApi
      .uploadAvatar(file)
      .then((u) => {
        updateUser({ avatarUrl: u.avatarUrl });
        toast.success("تصویر پروفایل به‌روزرسانی شد.");
      })
      .catch((e) => {
        toast.error(e instanceof ApiError ? e.message : "آپلود تصویر ناموفق بود.");
      })
      .finally(() => setUploadingAvatar(false));
  };

  const removeAvatar = async () => {
    setUploadingAvatar(true);
    try {
      await authApi.removeAvatar();
      updateUser({ avatarUrl: null });
      toast.info("تصویر پروفایل حذف شد.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "حذف تصویر ناموفق بود.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div>
      <PageHeader title="حساب کاربری" />

      <div className="space-y-4 pb-6">
        {/* Profile + avatar upload */}
        <section className="rounded-2xl border bg-card p-4 app-shadow">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {user ? (
                <div className="relative shrink-0">
                  <UserAvatar
                    user={user}
                    className="size-14 border border-border [&_[data-slot=avatar-fallback]]:text-lg"
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingAvatar}
                    aria-label="تغییر تصویر پروفایل"
                    className="absolute -bottom-1 -left-1 flex size-7 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-sm transition-transform active:scale-90 disabled:opacity-60"
                  >
                    {uploadingAvatar ? (
                      <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                    ) : (
                      <Camera className="size-3.5" aria-hidden />
                    )}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      onPickAvatar(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </div>
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold">{user?.name}</p>
                {user ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground nums" dir="ltr">
                    {toPersianDigits(user.mobile)}
                  </p>
                ) : null}
                {user?.avatarUrl ? (
                  <button
                    type="button"
                    onClick={() => void removeAvatar()}
                    disabled={uploadingAvatar}
                    className="mt-1 text-[11px] font-semibold text-danger hover:underline disabled:opacity-60"
                  >
                    حذف تصویر
                  </button>
                ) : (
                  <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                    تصویر مربع، حداکثر ۵ مگابایت
                  </p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ConnectionPill />
              <SyncStatusChip />
            </div>
          </div>
        </section>

        {/* Theme */}
        <section className="rounded-2xl border bg-card p-4 app-shadow">
          <p className="mb-3 text-sm font-bold">ظاهر برنامه</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="حالت نمایش">
            {THEMES.map((t) => (
              <button
                key={t.key}
                role="radio"
                aria-checked={theme === t.key}
                onClick={() => setTheme(t.key)}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-semibold transition-colors",
                  theme === t.key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input text-muted-foreground hover:bg-muted",
                )}
              >
                <t.icon className="size-5" aria-hidden />
                {t.label}
              </button>
            ))}
          </div>
        </section>

        {/* Offline simulation — demo-only (NEXT_PUBLIC_DEMO_MODE=1) */}
        {DEMO_MODE ? (
        <section className="rounded-2xl border bg-card p-4 app-shadow">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-bold">
                <WifiOff className="size-4 text-warning" aria-hidden />
                شبیه‌سازی قطع اینترنت
              </p>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                برای تست ثبت آفلاین: با فعال بودن این گزینه، گزارش‌های جدید روی دستگاه ذخیره و بعداً ارسال می‌شوند.
              </p>
            </div>
            <Switch checked={sim} onCheckedChange={setSim} aria-label="شبیه‌سازی قطع اینترنت" />
          </div>
        </section>
        ) : null}

        {/* Offline drafts */}
        <section className="rounded-2xl border bg-card p-4 app-shadow">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm font-bold">پیش‌نویس‌های ارسال‌نشده</p>
            {count > 0 ? (
              <Button size="sm" onClick={() => void syncNow()} disabled={syncing} className="h-9 gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold">
                {syncing ? <RefreshCcw className="size-3.5 animate-spin" aria-hidden /> : <CloudUpload className="size-3.5" aria-hidden />}
                ارسال همه
              </Button>
            ) : null}
          </div>
          {!drafts || drafts.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">پیش‌نویسی وجود ندارد — همه‌چیز همگام است.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {drafts.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-warning/40 bg-warning-soft/60 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold">{d.description}</p>
                    <p className="text-[11px] text-muted-foreground nums">
                      {relativeDayLabel(d.workDate)} • {minutesToHHMM(d.durationMinutes)}
                    </p>
                  </div>
                  <button
                    onClick={() => void removeDraft(d.id)}
                    aria-label="حذف پیش‌نویس"
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Install PWA */}
        <section className="rounded-2xl border bg-card p-4 app-shadow">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-bold">
                <Smartphone className="size-4 text-primary" aria-hidden />
                نصب روی گوشی
              </p>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                {canInstall
                  ? "زمان‌سنج را مثل یک اپلیکیشن روی گوشی نصب کنید."
                  : "برای نصب، از منوی مرورگر گزینه «Add to Home Screen» را انتخاب کنید."}
              </p>
            </div>
            {canInstall ? (
              <Button onClick={() => void install()} size="sm" className="h-10 shrink-0 gap-1.5 rounded-xl px-3.5 text-xs font-bold">
                <Download className="size-4" aria-hidden />
                نصب
              </Button>
            ) : null}
          </div>
        </section>

        {/* About + logout */}
        <section className="rounded-2xl border bg-card px-4 py-1 app-shadow">
          <div className="flex items-center justify-between py-3">
            <span className="flex items-center gap-1.5 text-sm font-bold">
              <Info className="size-4 text-muted-foreground" aria-hidden />
              نسخه برنامه
            </span>
            <span className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground nums" dir="ltr">{toPersianDigits(APP_VERSION)}</span>
              <button
                type="button"
                onClick={() => navigate("/about")}
                aria-label="درباره زمان‌سنج"
                title="درباره زمان‌سنج"
                className="ms-1 flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Info className="size-4" aria-hidden />
              </button>
            </span>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-3">
            <span className="text-sm font-bold">امروز</span>
            <span className="text-xs text-muted-foreground nums">{formatJalali(today(), "full")}</span>
          </div>
          <Separator />
          <button
            onClick={() => {
              signOut();
              toast.success("از حساب خارج شدید.");
            }}
            className="flex min-h-12 w-full items-center gap-2 text-sm font-bold text-danger"
          >
            <LogOut className="size-4.5" aria-hidden />
            خروج از حساب
          </button>
        </section>
      </div>
    </div>
  );
}
