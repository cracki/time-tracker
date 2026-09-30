"use client";

/**
 * Charts (spec §21/§22) — lazy-loaded recharts wrappers.
 * recharts is already in the stack (spec Rule 13: prefer existing stack).
 * Theme colors are read from CSS design tokens so dark mode works.
 */

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { TimeLogStatus } from "@/lib/types";
import { minutesToHHMM } from "@/lib/duration";
import { formatJalali } from "@/lib/jalali";
import { toPersianDigits } from "@/lib/format";
import { STATUS_META } from "./status-badge";

/* ── theme-aware token colors ───────────────────────────────── */

const TOKEN_DEFAULTS = ["#0F766E", "#10B981", "#F59E0B", "#EA580C", "#8B5CF6", "#64748B"];

function readTokens(): string[] {
  if (typeof document === "undefined") return TOKEN_DEFAULTS;
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  return [
    read("--chart-1", TOKEN_DEFAULTS[0]),
    read("--chart-2", TOKEN_DEFAULTS[1]),
    read("--chart-3", TOKEN_DEFAULTS[2]),
    read("--chart-4", TOKEN_DEFAULTS[3]),
    read("--chart-5", TOKEN_DEFAULTS[4]),
    read("--muted-foreground", TOKEN_DEFAULTS[5]),
  ];
}

function useTokenColors(): string[] {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = useState<string[]>(TOKEN_DEFAULTS);
  useEffect(() => {
    // read after paint — theme tokens are fresh once resolvedTheme settles
    const id = requestAnimationFrame(() => setColors(readTokens()));
    return () => cancelAnimationFrame(id);
  }, [resolvedTheme]);
  return colors;
}

export const STATUS_COLORS: Record<TimeLogStatus, string> = {
  approved: "#10B981",
  pending: "#F59E0B",
  adjusted: "#EA580C",
  rejected: "#EF4444",
};

/* ── lazy chart bodies ──────────────────────────────────────── */

const ChartBox = <P,>(load: () => Promise<React.ComponentType<P>>) =>
  dynamic(load, {
    ssr: false,
    loading: () => (
      <div className="flex h-44 animate-pulse items-end justify-center gap-2 px-6" aria-hidden>
        {[60, 90, 40, 75, 55].map((h, i) => (
          <div key={i} className="w-8 rounded-t-lg bg-muted" style={{ height: `${h}%` }} />
        ))}
      </div>
    ),
  });

const TrendBody = ChartBox(() => import("./chart-bodies").then((m) => m.TrendBody));
const PeopleBody = ChartBox(() => import("./chart-bodies").then((m) => m.PeopleBody));
const DonutBody = ChartBox(() => import("./chart-bodies").then((m) => m.DonutBody));
const StackBody = ChartBox(() => import("./chart-bodies").then((m) => m.StackBody));

export interface TrendPoint { date: string; logged: number; approved: number }

export function TrendChart({ data, height = 190 }: { data: TrendPoint[]; height?: number }) {
  const colors = useTokenColors();
  return <TrendBody data={data} colors={colors} height={height} />;
}

export function PeopleComparisonChart({ data }: { data: { name: string; minutes: number }[] }) {
  const colors = useTokenColors();
  return <PeopleBody data={data} colors={colors} />;
}

export function StatusDonutChart({ data }: { data: { status: TimeLogStatus; minutes: number; count: number }[] }) {
  return <DonutBody data={data} colors={STATUS_COLORS} />;
}

export function ApprovedVsPendingChart({ data }: { data: TrendPoint[] }) {
  return <StackBody data={data} colors={STATUS_COLORS} />;
}

export function ChartCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4 app-shadow">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold">{title}</h2>
          {subtitle ? <p className="text-[11px] text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/* ── Activity heatmap (pure CSS, spec §21.6) ────────────────── */

export function ActivityHeatmap({ data }: { data: { date: string; minutes: number }[] }) {
  const max = Math.max(60, ...data.map((d) => d.minutes));
  const level = (m: number) => (m === 0 ? 0 : m < max * 0.25 ? 1 : m < max * 0.5 ? 2 : m < max * 0.75 ? 3 : 4);
  const weeks: { date: string; minutes: number }[][] = [];
  for (let i = 0; i < data.length; i += 7) weeks.push(data.slice(i, i + 7));
  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-1 thin-scrollbar" dir="rtl">
        {weeks.map((w, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {w.map((d) => (
              <span
                key={d.date}
                title={`${formatJalali(d.date, "medium")} — ${minutesToHHMM(d.minutes)}`}
                className={cnHeat(level(d.minutes))}
                aria-label={`${formatJalali(d.date, "medium")}: ${minutesToHHMM(d.minutes)}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        <span>کم</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className={cnHeat(l)} />
        ))}
        <span>زیاد</span>
      </div>
    </div>
  );
}

function cnHeat(level: number): string {
  const base = "size-3 rounded-[4px] shrink-0";
  switch (level) {
    case 0: return `${base} bg-muted`;
    case 1: return `${base} bg-primary/25`;
    case 2: return `${base} bg-primary/45`;
    case 3: return `${base} bg-primary/70`;
    default: return `${base} bg-primary`;
  }
}

export function chartTickFormatterMinutes(v: number | string) {
  return minutesToHHMM(Number(v));
}

export function chartDateFormatter(iso: string) {
  return toPersianDigits(formatJalali(iso, "short").replace(/\/0+(\d)/g, "/$1"));
}
