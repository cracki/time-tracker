"use client";

/**
 * DateRangeFilter (spec §16/§24) — preset chips + custom range bottom sheet.
 */

import { useMemo, useState } from "react";
import { CalendarRange } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  RANGE_PRESETS, formatJalali, parseIso, presetRange, today,
} from "@/lib/jalali";
import { PersianDatePicker } from "./persian-date-picker";

export interface RangeValue {
  preset: string;
  from: Date;
  to: Date;
}

function presetLabel(preset: string): string {
  return RANGE_PRESETS.find((p) => p.key === preset)?.label ?? "بازه دلخواه";
}

export function DateRangeFilter({
  value,
  onChange,
  className,
}: {
  value: RangeValue | null;
  onChange: (v: RangeValue) => void;
  className?: string;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState<string | null>(null);
  const [customTo, setCustomTo] = useState<string | null>(null);

  const iso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const active = value?.preset ?? "";

  const label = useMemo(() => {
    if (!value) return "همه";
    if (value.preset === "custom") return `${formatJalali(value.from, "short")} تا ${formatJalali(value.to, "short")}`;
    return presetLabel(value.preset);
  }, [value]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto" role="tablist" aria-label="بازه زمانی">
        {RANGE_PRESETS.filter((p) => p.key !== "custom").map((p) => (
          <button
            key={p.key}
            role="tab"
            aria-selected={active === p.key}
            onClick={() => {
              const r = presetRange(p.key);
              if (r) onChange({ preset: p.key, from: r.from, to: r.to });
            }}
            className={cn(
              "min-h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
              active === p.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Drawer open={customOpen} onOpenChange={setCustomOpen}>
        <Button
          variant={active === "custom" ? "default" : "outline"}
          size="sm"
          className="h-9 shrink-0 gap-1.5 rounded-full px-3 text-[13px] font-semibold"
          onClick={() => {
            setCustomFrom(value ? iso(value.from) : null);
            setCustomTo(value ? iso(value.to) : null);
            setCustomOpen(true);
          }}
          aria-label="بازه دلخواه"
        >
          <CalendarRange className="size-4" aria-hidden />
          <span className="max-w-36 truncate">{active === "custom" ? label : "بازه دلخواه"}</span>
        </Button>
        <DrawerContent className="mx-auto max-w-md">
          <DrawerHeader>
            <DrawerTitle className="text-center text-base font-bold">انتخاب بازه زمانی</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4 px-6 pb-2">
            <div>
              <p className="mb-1.5 text-sm font-semibold text-muted-foreground">از تاریخ</p>
              <PersianDatePicker
                value={customFrom}
                onChange={setCustomFrom}
                holidays={[]}
                allowFuture
                placeholder="تاریخ شروع"
              />
            </div>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-muted-foreground">تا تاریخ</p>
              <PersianDatePicker
                value={customTo}
                onChange={setCustomTo}
                min={customFrom}
                allowFuture
                max={iso(today())}
                placeholder="تاریخ پایان"
              />
            </div>
          </div>
          <div className="px-6 pb-6 pt-2 safe-bottom">
            <Button
              className="h-12 w-full rounded-2xl text-base font-bold"
              disabled={!customFrom || !customTo}
              onClick={() => {
                if (customFrom && customTo) {
                  onChange({ preset: "custom", from: parseIso(customFrom), to: parseIso(customTo) });
                  setCustomOpen(false);
                }
              }}
            >
              اعمال بازه
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
