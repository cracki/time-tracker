"use client";

import { CheckCircle2, Clock, MoonStar, XCircle, PenLine, CalendarX2 } from "lucide-react";
import { TimeLogStatus, OutsideHoursKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

/** Status visual system — color + icon + label (spec §2.4/§27). Never color alone. */

export const STATUS_META: Record<
  TimeLogStatus,
  { label: string; icon: LucideIcon; soft: string; text: string; solid: string; dot: string; stroke: string }
> = {
  pending: {
    label: "در انتظار تأیید",
    icon: Clock,
    soft: "bg-warning-soft text-warning",
    text: "text-warning",
    solid: "bg-warning text-white",
    dot: "bg-warning",
    stroke: "border-r-warning",
  },
  approved: {
    label: "تأیید شده",
    icon: CheckCircle2,
    soft: "bg-success-soft text-success",
    text: "text-success",
    solid: "bg-success text-white",
    dot: "bg-success",
    stroke: "border-r-success",
  },
  adjusted: {
    label: "اصلاح شده",
    icon: PenLine,
    soft: "bg-adjusted-soft text-adjusted",
    text: "text-adjusted",
    solid: "bg-adjusted text-white",
    dot: "bg-adjusted",
    stroke: "border-r-adjusted",
  },
  rejected: {
    label: "رد شده",
    icon: XCircle,
    soft: "bg-danger-soft text-danger",
    text: "text-danger",
    solid: "bg-danger text-white",
    dot: "bg-danger",
    stroke: "border-r-danger",
  },
};

export function StatusBadge({ status, size = "sm", className }: { status: TimeLogStatus; size?: "sm" | "xs"; className?: string }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        meta.soft,
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]",
        className,
      )}
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-3"} aria-hidden />
      {meta.label}
    </span>
  );
}

export const OUTSIDE_META: Record<OutsideHoursKind, { label: string; icon: LucideIcon | null; cls: string } | null> = {
  normal: null,
  outside: { label: "خارج از ساعت اداری", icon: MoonStar, cls: "bg-outside-soft text-outside" },
  holiday: { label: "تعطیل رسمی", icon: CalendarX2, cls: "bg-danger-soft text-danger" },
  weekend: { label: "آخر هفته", icon: null, cls: "bg-muted text-muted-foreground" },
};

export function OutsideBadge({ kind, size = "sm" }: { kind: OutsideHoursKind; size?: "sm" | "xs" }) {
  const meta = OUTSIDE_META[kind];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        meta.cls,
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]",
      )}
    >
      {Icon ? <Icon className={size === "sm" ? "size-3.5" : "size-3"} aria-hidden /> : <span className={cn("rounded-full", size === "sm" ? "size-1.5" : "size-1", "bg-current")} aria-hidden />}
      {meta.label}
    </span>
  );
}
