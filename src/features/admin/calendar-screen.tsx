"use client";

/**
 * Calendar Settings (spec §11/§59) — working days + start/end times,
 * week preview. Persian week: شنبه…جمعه.
 */

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Info } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { PageSpinner, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { calendarApi } from "@/lib/api";
import { J_WEEKDAYS } from "@/lib/jalali";
import { toLatinDigits, toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

const DAY_ORDER = [0, 1, 2, 3, 4, 5, 6]; // شنبه → جمعه

export function CalendarScreen() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["calendar"],
    queryFn: () => calendarApi.get(),
  });

  const [days, setDays] = useState<number[]>([]);
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("17:00");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setDays(data.calendar.workingDays);
      setStart(data.calendar.workingStartTime);
      setEnd(data.calendar.workingEndTime);
    }
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      if (days.length === 0) throw new Error("حداقل یک روز کاری انتخاب کنید.");
      if (start >= end) throw new Error("ساعت شروع باید قبل از ساعت پایان باشد.");
      const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
      if (!timeRe.test(start) || !timeRe.test(end)) throw new Error("ساعت‌ها را به فرمت HH:MM وارد کنید.");
      await calendarApi.updateSettings({ workingDays: days, workingStartTime: start, workingEndTime: end });
      toast.success("تنظیمات تقویم ذخیره شد.");
      void qc.invalidateQueries({ queryKey: ["calendar"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ذخیره ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <PageSpinner />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  return (
    <div>
      <PageHeader title="تقویم کاری" subtitle="ساعات کاری سازمان برای همه یکسان است" />

      <div className="space-y-4 pb-6">
        {/* Working days */}
        <section className="rounded-2xl border bg-card p-4 app-shadow">
          <p className="mb-1 text-sm font-bold">روزهای کاری</p>
          <p className="mb-3 text-xs text-muted-foreground">روزهای غیرکاری به‌عنوان آخر هفته علامت‌گذاری می‌شوند.</p>
          <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="روزهای کاری">
            {DAY_ORDER.map((d) => {
              const active = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))}
                  aria-pressed={active}
                  className={cn(
                    "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl border text-[11px] font-bold transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-card text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span>{J_WEEKDAYS[d].slice(0, 3)}</span>
                  {active ? <Check className="size-3" aria-hidden /> : <span className="text-[9px] font-normal">تعطیل</span>}
                </button>
              );
            })}
          </div>
        </section>

        {/* Working hours */}
        <section className="rounded-2xl border bg-card p-4 app-shadow">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-bold">
            <Clock className="size-4 text-primary" aria-hidden />
            ساعات کاری
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="start" className="mb-1.5 block text-xs font-semibold">شروع</Label>
              <Input
                id="start"
                dir="ltr"
                inputMode="numeric"
                value={start}
                onChange={(e) => setStart(toLatinDigits(e.target.value).slice(0, 5))}
                className="h-12 rounded-xl bg-card text-center text-base font-bold nums"
                placeholder="08:00"
              />
            </div>
            <div>
              <Label htmlFor="end" className="mb-1.5 block text-xs font-semibold">پایان</Label>
              <Input
                id="end"
                dir="ltr"
                inputMode="numeric"
                value={end}
                onChange={(e) => setEnd(toLatinDigits(e.target.value).slice(0, 5))}
                className="h-12 rounded-xl bg-card text-center text-base font-bold nums"
                placeholder="17:00"
              />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground nums" dir="ltr">
            {toPersianDigits(start)} — {toPersianDigits(end)}
          </p>
        </section>

        {/* Info */}
        <div className="flex items-start gap-2 rounded-xl bg-muted/60 px-3.5 py-3 text-xs leading-6 text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          ثبت گزارش در روزها و ساعات غیرکاری مجاز است؛ سیستم فقط آن را در گزارش‌ها علامت‌گذاری می‌کند و گزارش رد یا مسدود نمی‌شود.
        </div>

        <Button onClick={save} disabled={saving} className="h-13 w-full rounded-2xl text-base font-bold shadow-lg shadow-primary/20">
          {saving ? "در حال ذخیره…" : "ذخیره تنظیمات"}
        </Button>
      </div>
    </div>
  );
}
