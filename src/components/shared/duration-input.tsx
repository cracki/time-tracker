"use client";

/**
 * DurationInput (spec §10/§29) — HH:MM mask, numeric keyboard, progressive
 * digits (typing "230" → 02:30), instant validation, quick-duration chips.
 * The value is stored in minutes; never as a string.
 */

import { useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toLatinDigits, toPersianDigits } from "@/lib/format";

const QUICK = [
  { minutes: 30, label: "00:30" },
  { minutes: 60, label: "01:00" },
  { minutes: 90, label: "01:30" },
  { minutes: 120, label: "02:00" },
];

/** "0230" → { h:2, m:30 } — digits fill HH:MM right-aligned */
function splitDigits(d: string): { h: number; m: number } {
  if (d.length <= 2) return { h: 0, m: Number(d || 0) };
  return { h: Number(d.slice(0, d.length - 2)), m: Number(d.slice(-2)) };
}

function digitsToMinutes(d: string): number {
  const { h, m } = splitDigits(d);
  return h * 60 + m;
}

function minutesToDigits(v: number): string {
  const h = Math.floor(v / 60);
  const m = v % 60;
  return String(h).padStart(2, "0") + String(m).padStart(2, "0");
}

export function DurationInput({
  value,
  onChange,
  error,
  onErrorChange,
  autoFocus,
}: {
  value: number | null;
  onChange: (m: number | null) => void;
  error?: string | null;
  onErrorChange?: (msg: string | null) => void;
  autoFocus?: boolean;
}) {
  const initial = value && value > 0 ? minutesToDigits(value) : "";
  const [state, setState] = useState<{ digits: string; value: number }>(() => ({ digits: initial, value: value ?? 0 }));
  const digits = state.digits;
  const inputRef = useRef<HTMLInputElement>(null);

  // Adjust state during render when external value changes
  // (React-approved pattern; keeps user's in-progress digits when they echo the same value).
  const extValue = value ?? 0;
  if (extValue !== state.value) {
    const curMin = digitsToMinutes(state.digits);
    setState({
      digits: curMin === extValue ? state.digits : value && value > 0 ? minutesToDigits(value) : "",
      value: extValue,
    });
  }

  const validate = (d: string): string | null => {
    if (!d) return null;
    const { h, m } = splitDigits(d);
    if (m > 59) return "دقیقه نمی‌تواند بیشتر از ۵۹ باشد.";
    if (h > 23) return "ساعت نمی‌تواند بیشتر از ۲۳ باشد.";
    return null;
  };

  const applyDigits = (d: string) => {
    setState({ digits: d, value: -1 }); // -1 marks "own typing" until parent echoes back
    const err = validate(d);
    onErrorChange?.(err);
    if (!d) {
      onChange(null);
      return;
    }
    const total = digitsToMinutes(d);
    onChange(err || total <= 0 ? null : total);
  };

  const display = useMemo(() => {
    if (!digits) return "";
    const p = digits.padStart(4, "0");
    return toPersianDigits(`${p.slice(0, 2)}:${p.slice(2)}`);
  }, [digits]);

  /**
   * Mask parsing: the visible value includes auto-padded zeros, so raw
   * e.target.value parsing would swallow them ("۰۰:۰۱"+"4" → 00014).
   * We diff the input against the current display instead.
   */
  const handleInput = (raw: string) => {
    if (raw === display) return;
    if (raw.length > display.length && raw.startsWith(display)) {
      const appended = toLatinDigits(raw.slice(display.length)).replace(/\D/g, "");
      applyDigits((digits + appended).slice(-4));
      return;
    }
    if (raw.length < display.length) {
      const removed = display.length - raw.length;
      applyDigits(digits.slice(0, Math.max(0, digits.length - removed)));
      return;
    }
    // full replacement (paste / select-all)
    applyDigits(toLatinDigits(raw).replace(/\D/g, "").slice(0, 4));
  };

  return (
    <div>
      <div
        className={cn(
          "relative flex items-center gap-3 rounded-2xl border bg-card px-4 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
          error ? "border-danger" : "border-input",
        )}
        onClick={() => inputRef.current?.focus()}
      >
        <Clock className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          inputMode="numeric"
          autoComplete="off"
          aria-label="مدت زمان به فرمت ساعت:دقیقه"
          aria-invalid={!!error}
          className="h-14 w-full bg-transparent text-2xl font-bold tracking-widest outline-none placeholder:text-lg placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground/60"
          placeholder={toPersianDigits("۰۲:۳۰")}
          value={display}
          onChange={(e) => handleInput(e.target.value)}
          onSelect={(e) => {
            // mask caret always stays at the end
            const el = e.currentTarget;
            const len = el.value.length;
            if (el.selectionStart !== len) el.setSelectionRange(len, len);
          }}
          onFocus={(e) => {
            const len = e.target.value.length;
            requestAnimationFrame(() => e.target.setSelectionRange(len, len));
          }}
        />
      </div>

      {error ? (
        <p className="mt-1.5 text-xs font-medium text-danger" role="alert">{error}</p>
      ) : (
        <div className="mt-2.5 flex flex-wrap gap-2" role="group" aria-label="مدت‌های پیشنهادی">
          {QUICK.map((q) => {
            const active = value === q.minutes;
            return (
              <button
                key={q.minutes}
                type="button"
                aria-label={`ثبت ${q.label}`}
                onClick={() => applyDigits(minutesToDigits(q.minutes))}
                className={cn(
                  "min-h-10 rounded-xl border px-3.5 text-sm font-semibold nums transition-all active:scale-95",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-card text-foreground hover:border-primary/40 hover:bg-accent/60",
                )}
              >
                {toPersianDigits(q.label)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
