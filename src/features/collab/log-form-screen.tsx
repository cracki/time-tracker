"use client";

/**
 * Create/Edit Log (spec §8/§17/§29/§30/§32).
 * - Default date = today, backdate limited (config: 3 days)
 * - Copy previous via ?copy=<id>
 * - Offline submit → IndexedDB draft + clear user feedback
 */

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, MoonStar, Save, Trash2, TriangleAlert, CalendarX2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DurationInput } from "@/components/shared/duration-input";
import { PersianDatePicker } from "@/components/shared/persian-date-picker";
import { OutsideBadge } from "@/components/shared/status-badge";
import { PageSpinner } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ApiError, CONFIG, calendarApi, collabApi, computeOutsideKind, draftApi } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "@/navigation/router";
import { addDays, formatJalali, isoDate, parseIso, today } from "@/lib/jalali";
import { toPersianDigits } from "@/lib/format";
import { humanDuration } from "@/lib/duration";
import { OutsideHoursKind } from "@/lib/types";

export function LogFormScreen({ editId, copyId }: { editId?: string; copyId?: string }) {
  const { user } = useAuth();
  const { navigate, back } = useRouter();
  const qc = useQueryClient();

  const isEdit = !!editId;

  const [date, setDate] = useState<string | null>(isoDate(today()));
  const [duration, setDuration] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [durationError, setDurationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const minIso = isoDate(addDays(today(), -CONFIG.backdateLimitDays));
  const maxIso = isoDate(today());

  const { data: existing } = useQuery({
    queryKey: ["log", editId],
    queryFn: async () => {
      const res = await collabApi.getLog(editId!);
      return res.log;
    },
    enabled: isEdit && !!user,
  });

  const { data: copySource } = useQuery({
    queryKey: ["log", copyId],
    queryFn: async () => {
      const res = await collabApi.getLog(copyId!);
      return res.log;
    },
    enabled: !isEdit && !!copyId && !!user,
  });

  // prefill for edit / copy
  useEffect(() => {
    if (isEdit && existing) {
      setDate(existing.workDate);
      setDuration(existing.originalDurationMinutes);
      setDescription(existing.description ?? "");
    }
  }, [isEdit, existing]);

  useEffect(() => {
    if (!isEdit && copySource) {
      setDuration(copySource.originalDurationMinutes);
      setDescription(copySource.description);
      setDate(isoDate(today())); // copy content, not date
      toast.info("اطلاعات آخرین گزارش کپی شد — قابل ویرایش است.");
    }
  }, [isEdit, copySource]);

  // calendar + holidays for date-picker dots and outside-hours hint
  const { data: settings } = useQuery({
    queryKey: ["calendar-settings"],
    queryFn: () => calendarApi.get(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // outside-hours preview (spec §13) — server is authoritative on submit
  const outsideKind: OutsideHoursKind = useMemo(() => {
    if (!date || !settings) return "normal";
    return computeOutsideKind(date, settings.calendar, settings.holidays.map((h) => h.date));
  }, [date, settings]);

  const canSubmit = !!date && !!duration && duration > 0 && description.trim().length > 0 && !durationError && !submitting;

  const submit = async () => {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    try {
      if (isEdit) {
        await collabApi.updateLog(user.id, editId!, { workDate: date!, description, durationMinutes: duration! });
        toast.success("گزارش بروزرسانی شد.");
      } else {
        await collabApi.createLog(user.id, { workDate: date!, description, durationMinutes: duration! });
        toast.success("زمان ثبت شد — در انتظار تأیید مدیر.");
      }
      qc.invalidateQueries({ queryKey: ["my-dashboard"] });
      qc.invalidateQueries({ queryKey: ["my-logs"] });
      navigate("/logs", { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.code === "offline") {
        await draftApi.saveDraft({ workDate: date!, description, durationMinutes: duration! });
        toast.warning("در حالت آفلاین — ثبت شما روی دستگاه ذخیره شد. پس از اتصال، ارسال خواهد شد.", { duration: 5000 });
        navigate("/logs", { replace: true });
      } else {
        toast.error(e instanceof ApiError ? e.message : "ثبت ناموفق بود. دوباره تلاش کنید.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const removeLog = async () => {
    if (!user || !editId) return;
    try {
      await collabApi.deleteLog(user.id, editId);
      toast.success("گزارش حذف شد.");
      qc.invalidateQueries();
      navigate("/logs", { replace: true });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "حذف ناموفق بود.");
    }
  };

  if (isEdit && !existing) {
    return <PageSpinner />;
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? "ویرایش گزارش" : "ثبت زمان جدید"}
        subtitle={isEdit ? "فقط گزارش‌های در انتظار تأیید قابل ویرایش هستند" : undefined}
        back
      />

      <div className="space-y-5 pb-6">
        {/* Date */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <Label htmlFor="date-picker" className="text-sm font-semibold">تاریخ کار</Label>
            <span className="text-xs text-muted-foreground">حداکثر {toPersianDigits(CONFIG.backdateLimitDays)} روز قبل</span>
          </div>
          <PersianDatePicker
            value={date}
            onChange={setDate}
            min={minIso}
            max={maxIso}
            holidays={settings?.holidays ?? []}
          />
          {date ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3.5" aria-hidden />
                {formatJalali(date, "full")}
              </span>
              {outsideKind !== "normal" ? (
                <span className="flex items-center gap-1">
                  {outsideKind === "holiday" ? <CalendarX2 className="size-3.5 text-danger" aria-hidden /> : <MoonStar className="size-3.5 text-outside" aria-hidden />}
                  ثبت در روز غیرکاری مجاز است — در گزارش علامت‌گذاری می‌شود
                </span>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* Outside preview badge */}
        {outsideKind !== "normal" ? (
          <div className="flex items-center gap-2">
            <OutsideBadge kind={outsideKind} />
            <span className="text-xs text-muted-foreground">این گزارش به‌عنوان خارج از ساعات اداری ثبت می‌شود</span>
          </div>
        ) : null}

        {/* Duration */}
        <section>
          <Label className="mb-2 block text-sm font-semibold">مدت زمان</Label>
          <DurationInput value={duration} onChange={setDuration} error={durationError} onErrorChange={setDurationError} />
          {duration && !durationError ? (
            <p className="mt-1.5 text-xs text-muted-foreground">{humanDuration(duration)}</p>
          ) : null}
        </section>

        {/* Description */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <Label htmlFor="desc" className="text-sm font-semibold">توضیحات</Label>
            <span className="text-xs text-muted-foreground nums">{toPersianDigits(description.length)}/{toPersianDigits(300)}</span>
          </div>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 300))}
            placeholder="مثلاً: توسعه API پرداخت"
            rows={3}
            className="resize-none rounded-2xl bg-card text-[15px] leading-7"
          />
        </section>

        {/* Info hint */}
        {!isEdit ? (
          <div className="flex items-start gap-2 rounded-xl bg-muted/60 px-3.5 py-3 text-xs leading-6 text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            گزارش بعد از ثبت در وضعیت «در انتظار تأیید» قرار می‌گیرد و تا قبل از تصمیم مدیر قابل ویرایش است.
          </div>
        ) : null}

        {/* Submit */}
        <div className="sticky bottom-24 z-20 lg:bottom-6">
          <div className="flex gap-2.5 rounded-2xl border bg-card/95 p-2.5 shadow-xl backdrop-blur">
            {isEdit ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon" className="size-13 shrink-0 rounded-xl border-danger/30 text-danger hover:bg-danger-soft" aria-label="حذف گزارش">
                    <Trash2 className="size-5" aria-hidden />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent dir="rtl" className="max-w-sm rounded-3xl">
                  <AlertDialogHeader className="text-right">
                    <AlertDialogTitle>حذف این گزارش؟</AlertDialogTitle>
                    <AlertDialogDescription>این گزارش برای همیشه حذف می‌شود و قابل بازگشت نیست.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-row justify-start gap-2">
                    <AlertDialogAction onClick={() => void removeLog()} className="bg-danger text-white hover:bg-danger/90">حذف</AlertDialogAction>
                    <AlertDialogCancel>انصراف</AlertDialogCancel>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
            <Button
              onClick={submit}
              disabled={!canSubmit}
              className="h-13 flex-1 rounded-xl text-base font-bold shadow-lg shadow-primary/20 transition-transform active:scale-[0.98]"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
                  در حال ذخیره…
                </span>
              ) : (
                <>
                  <Save className="size-5" aria-hidden />
                  {isEdit ? "ذخیره تغییرات" : "ثبت زمان"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
