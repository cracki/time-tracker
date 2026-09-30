"use client";

/**
 * Actual recharts bodies — loaded lazily via next/dynamic from charts.tsx.
 * Keeps Chart.js-sized deps out of the initial bundle (spec §65).
 */

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { TimeLogStatus } from "@/lib/types";
import { minutesToHHMM } from "@/lib/duration";
import { relativeDayLabel } from "@/lib/jalali";
import { STATUS_META } from "./status-badge";
import { chartTickFormatterMinutes, chartDateFormatter, TrendPoint } from "./charts";

const AXIS = { fontSize: 11, fontFamily: "Vazirmatn" };

function TooltipBox({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string; payload?: Record<string, unknown> }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const p0 = payload[0]?.payload as Record<string, unknown> | undefined;
  const title = (p0?.__title as string) ?? (typeof label === "string" ? label : "");
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-lg" dir="rtl">
      {title ? <p className="mb-1 font-bold">{title}</p> : null}
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden />
          <span>{entry.name}:</span>
          <span className="font-bold nums">{minutesToHHMM(Number(entry.value ?? 0))}</span>
        </p>
      ))}
    </div>
  );
}

function DonutTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string; payload?: Record<string, unknown> }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-lg" dir="rtl">
      <p className="font-bold">{p.name}</p>
      <p className="nums">{minutesToHHMM(Number(p.value ?? 0))}</p>
    </div>
  );
}

export function TrendBody({ data, colors, height = 190 }: { data: TrendPoint[]; colors: string[]; height?: number }) {
  const withTitle = data.map((d) => ({ ...d, __title: relativeDayLabel(d.date) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={withTitle} margin={{ top: 8, left: 0, right: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gLogged" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors[0]} stopOpacity={0.35} />
            <stop offset="100%" stopColor={colors[0]} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gApproved" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors[1]} stopOpacity={0.3} />
            <stop offset="100%" stopColor={colors[1]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tickFormatter={chartDateFormatter}
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={28}
          reversed
        />
        <YAxis
          orientation="right"
          tickFormatter={chartTickFormatterMinutes}
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip content={<TooltipBox />} />
        <Area type="monotone" dataKey="logged" name="ثبت‌شده" stroke={colors[0]} strokeWidth={2.5} fill="url(#gLogged)" animationDuration={650} />
        <Area type="monotone" dataKey="approved" name="تأییدشده" stroke={colors[1]} strokeWidth={2} fill="url(#gApproved)" animationDuration={800} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * "بیشترین زمان افراد" — recharts is not RTL-aware (category axis labels
 * clip/misplace under dir=rtl), so this chart is a pure-CSS horizontal bar
 * list instead: the browser lays the Persian names out natively in RTL.
 */
export function PeopleBody({ data, colors }: { data: { name: string; minutes: number }[]; colors: string[] }) {
  const max = Math.max(60, ...data.map((d) => d.minutes));
  if (data.length === 0) {
    return <p className="py-8 text-center text-xs text-muted-foreground">داده‌ای برای نمایش نیست.</p>;
  }
  return (
    <ul className="space-y-2.5 py-1" aria-label="بیشترین زمان افراد">
      {data.map((d) => {
        const pct = max > 0 ? Math.max(2, Math.round((d.minutes / max) * 100)) : 0;
        return (
          <li key={d.name} className="grid grid-cols-[5.5rem_1fr] items-center gap-x-3">
            <span className="truncate text-xs font-semibold" title={d.name}>{d.name}</span>
            <span className="flex items-center gap-2">
              <span className="h-4 flex-1 overflow-hidden rounded-full bg-muted/70" role="img" aria-label={`${d.name}: ${minutesToHHMM(d.minutes)}`}>
                <span
                  className="block h-full rounded-full transition-[width] duration-700"
                  style={{ width: `${pct}%`, backgroundColor: colors[0] }}
                />
              </span>
              <span className="shrink-0 text-[11px] font-bold text-muted-foreground nums">{minutesToHHMM(d.minutes)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function DonutBody({ data, colors }: { data: { status: TimeLogStatus; minutes: number; count: number }[]; colors: Record<TimeLogStatus, string> }) {
  const total = data.reduce((s, d) => s + d.minutes, 0);
  const items = data.filter((d) => d.minutes > 0).map((d) => ({ ...d, name: STATUS_META[d.status].label, color: colors[d.status] }));
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={items}
            dataKey="minutes"
            nameKey="name"
            innerRadius={62}
            outerRadius={88}
            paddingAngle={3}
            cornerRadius={6}
            animationDuration={700}
            strokeWidth={0}
          >
            {items.map((d) => (
              <Cell key={d.status} fill={d.color} />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(v: string) => <span style={{ fontSize: 11, fontFamily: "Vazirmatn" }}>{v}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 top-[62px] text-center" style={{ height: 0 }}>
        <p className="text-lg font-extrabold nums">{minutesToHHMM(total)}</p>
        <p className="text-[10px] text-muted-foreground">کل زمان</p>
      </div>
    </div>
  );
}

export function StackBody({ data, colors }: { data: TrendPoint[]; colors: Record<TimeLogStatus, string> }) {
  const withTitle = data.map((d) => ({
    ...d,
    pending: Math.max(0, d.logged - d.approved),
    __title: relativeDayLabel(d.date),
  }));
  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={withTitle} margin={{ top: 8, left: 0, right: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="date" tickFormatter={chartDateFormatter} tick={AXIS} tickLine={false} axisLine={false} reversed minTickGap={24} />
        <YAxis orientation="right" tickFormatter={chartTickFormatterMinutes} tick={AXIS} tickLine={false} axisLine={false} width={52} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: "var(--accent)", opacity: 0.5 }} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(v: string) => <span style={{ fontSize: 11, fontFamily: "Vazirmatn" }}>{v}</span>}
        />
        <Bar dataKey="approved" name="تأییدشده" stackId="s" fill={colors.approved} barSize={18} animationDuration={600} />
        <Bar dataKey="pending" name="در انتظار" stackId="s" fill={colors.pending} radius={[6, 6, 0, 0]} barSize={18} animationDuration={700} />
      </BarChart>
    </ResponsiveContainer>
  );
}
