"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./animated-number";

type Tone = "default" | "primary" | "success" | "warning" | "danger" | "adjusted" | "outside";

const TONE: Record<Tone, { icon: string; ring: string }> = {
  default: { icon: "bg-muted text-muted-foreground", ring: "" },
  primary: { icon: "bg-accent text-accent-foreground", ring: "" },
  success: { icon: "bg-success-soft text-success", ring: "" },
  warning: { icon: "bg-warning-soft text-warning", ring: "" },
  danger: { icon: "bg-danger-soft text-danger", ring: "" },
  adjusted: { icon: "bg-adjusted-soft text-adjusted", ring: "" },
  outside: { icon: "bg-outside-soft text-outside", ring: "" },
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  format,
  loading,
  onClick,
  className,
}: {
  label: string;
  /** raw number (minutes or count) — formatted via `format` */
  value: number;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  format?: (v: number) => string;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl border bg-card p-3.5 app-shadow transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        onClick && "cursor-pointer hover:border-primary/40 active:bg-accent/40",
        className,
      )}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground leading-5">{label}</span>
        {Icon ? (
          <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", t.icon)}>
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 text-xl font-bold nums tracking-tight tabular-nums">
        {loading ? <span className="inline-block h-7 w-16 animate-pulse rounded-md bg-muted" /> : (
          <AnimatedNumber value={value} format={format} />
        )}
      </div>
      {hint ? <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
