"use client";

/**
 * PersianDatePicker (spec §16) — Jalali month grid, Saturday-first,
 * holiday dots, weekend dimming, min/max (backdate limit), quick picks.
 * Mobile-first: vaul bottom sheet; centered card ≥sm.
 */

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerPortal } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/format";
import {
  J_MONTHS, J_WEEKDAYS_SHORT, addDays, dateToJalali, formatJalali, isWeekend,
  jalaliMonthLength, jalaliToDate, parseIso, today,
} from "@/lib/jalali";

export interface HolidayInfo { date: string; title: string }

export function PersianDatePicker({
  value,
  onChange,
  min,
  max,
  holidays = [],
  allowClear = false,
  allowFuture = false,
  placeholder = "انتخاب تاریخ",
  triggerClassName,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  min?: string | null;
  max?: string | null;
  holidays?: HolidayInfo[];
  allowClear?: boolean;
  allowFuture?: boolean;
  placeholder?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const t = today();
  const initial = value ? parseIso(value) : t;
  const [view, setView] = useState(() => ({ ...dateToJalali(initial) }));

  const holidayMap = useMemo(() => {
    const m = new Map<string, string>();
    holidays.forEach((h) => m.set(h.date, h.title));
    return m;
  }, [holidays]);

  const days = useMemo(() => {
    const len = jalaliMonthLength(view.jy, view.jm);
    const first = jalaliToDate(view.jy, view.jm, 1);
    const offset = (first.getDay() + 1) % 7; // 0 = شنبه
    const cells: (Date | null)[] = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= len; d++) cells.push(jalaliToDate(view.jy, view.jm, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [view]);

  const canPrev = !min || jalaliToDate(view.jy, view.jm, 1) > parseIso(min);
  const canNext = (() => {
    const g = dateToJalali(addDays(firstOfView(view), 32));
    const firstNext = jalaliToDate(g.jy, g.jm, 1);
    const limit = max ? parseIso(max) : allowFuture ? null : t;
    if (!limit) return true;
    return firstNext <= limit;
  })();

  function firstOfView(v: { jy: number; jm: number }) {
    return jalaliToDate(v.jy, v.jm, 1);
  }

  const shiftMonth = (dir: 1 | -1) => {
    let { jy, jm } = view;
    jm += dir;
    if (jm > 12) { jm = 1; jy++; }
    if (jm < 1) { jm = 12; jy--; }
    setView({ jy, jm, jd: 1 });
  };

  const select = (d: Date) => {
    onChange(isoOfDay(d));
    setOpen(false);
  };

  const todayIso = isoOfDay(t);

  return (
    <Drawer open={open} onOpenChange={(o) => { setOpen(o); if (o) setView({ ...dateToJalali(value ? parseIso(value) : t) }); }}>
      <DrawerTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-11 w-full items-center gap-2.5 rounded-2xl border border-input bg-card px-4 text-right transition-colors hover:border-primary/40",
            triggerClassName,
          )}
          aria-label="انتخاب تاریخ"
        >
          <CalendarDays className="size-5 shrink-0 text-primary" aria-hidden />
          <span className={cn("flex-1 truncate text-sm font-semibold nums", !value && "font-normal text-muted-foreground")}>
            {value ? formatJalali(value, "full") : placeholder}
          </span>
        </button>
      </DrawerTrigger>
      <DrawerPortal>
        <DrawerContent className="mx-auto max-w-md">
          <DrawerHeader className="pb-2 pt-3">
            <DrawerTitle className="sr-only">انتخاب تاریخ</DrawerTitle>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                disabled={!canPrev}
                aria-label="ماه قبل"
                className="flex size-10 items-center justify-center rounded-full hover:bg-muted disabled:opacity-30"
              >
                <ChevronRight className="size-5" aria-hidden />
              </button>
              <div className="text-base font-bold">
                {J_MONTHS[view.jm - 1]} <span className="nums text-muted-foreground">{toPersianDigits(view.jy)}</span>
              </div>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                disabled={!canNext}
                aria-label="ماه بعد"
                className="flex size-10 items-center justify-center rounded-full hover:bg-muted disabled:opacity-30"
              >
                <ChevronLeft className="size-5" aria-hidden />
              </button>
            </div>
          </DrawerHeader>

          <div className="px-4 pb-2">
            <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
              {J_WEEKDAYS_SHORT.map((w) => (
                <span key={w} className="py-1">{w}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {days.map((d, i) => {
                if (!d) return <span key={`x-${i}`} />;
                const iso = isoOfDay(d);
                const isSelected = value === iso;
                const isToday = iso === todayIso;
                const holidayTitle = holidayMap.get(iso);
                const disabled =
                  (min && iso < min) ||
                  (!allowFuture && (max ? iso > max : iso > todayIso)) ||
                  (allowFuture && max && iso > max);
                const weekend = isWeekend(d);
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={!!disabled}
                    onClick={() => select(d)}
                    title={holidayTitle}
                    aria-label={`${formatJalali(d, "full")}${holidayTitle ? " — " + holidayTitle : ""}`}
                    aria-pressed={isSelected}
                    className={cn(
                      "relative mx-auto flex size-10 flex-col items-center justify-center rounded-xl text-sm font-medium transition-colors",
                      isSelected
                        ? "bg-primary font-bold text-primary-foreground"
                        : disabled
                          ? "text-muted-foreground/40"
                          : holidayTitle
                            ? "text-danger hover:bg-danger-soft"
                            : weekend
                              ? "text-muted-foreground hover:bg-muted"
                              : "hover:bg-accent",
                      !isSelected && isToday && "ring-1 ring-primary/60",
                    )}
                  >
                    <span className="nums">{toPersianDigits(dateToJalali(d).jd)}</span>
                    {holidayTitle && !isSelected ? (
                      <span className="absolute bottom-1 size-1 rounded-full bg-danger" aria-hidden />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t px-4 py-3 safe-bottom">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => select(t)}
                disabled={!!min && todayIso < min}
                className="min-h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/70 disabled:opacity-40"
              >
                امروز
              </button>
              <button
                type="button"
                onClick={() => select(addDays(t, -1))}
                disabled={!!min && isoOfDay(addDays(t, -1)) < min}
                className="min-h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/70 disabled:opacity-40"
              >
                دیروز
              </button>
            </div>
            {allowClear ? (
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); }}
                className="min-h-10 rounded-xl px-4 text-sm font-semibold text-muted-foreground hover:bg-muted"
              >
                پاک کردن
              </button>
            ) : null}
          </div>
        </DrawerContent>
      </DrawerPortal>
    </Drawer>
  );
}

function isoOfDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
