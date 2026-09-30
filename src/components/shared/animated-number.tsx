"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { toPersianDigits } from "@/lib/format";

/** Animated KPI counter (spec §22 — short, smooth, reduced-motion aware). */
export function AnimatedNumber({
  value,
  duration = 550,
  format = (v: number) => toPersianDigits(Math.round(v)),
  className,
}: {
  value: number;
  duration?: number;
  format?: (v: number) => string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    if (from === value) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration, reduce]);

  return (
    <span className={className}>
      {format(display)}
    </span>
  );
}
