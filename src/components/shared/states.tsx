"use client";

import { CloudOff, RefreshCcw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/format";

/** Empty state (spec §46) */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="mb-4 flex size-16 items-center justify-center rounded-3xl bg-muted">
        {Icon ? <Icon className="size-7 text-muted-foreground" aria-hidden /> : null}
      </div>
      <p className="text-base font-semibold">{title}</p>
      {description ? <p className="mt-1 max-w-xs text-sm leading-6 text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** Human-readable error state (spec §47) */
export function ErrorState({
  title = "دریافت اطلاعات با مشکل مواجه شد.",
  description,
  onRetry,
  offline,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  offline?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="mb-4 flex size-16 items-center justify-center rounded-3xl bg-danger-soft">
        {offline
          ? <WifiOff className="size-7 text-danger" aria-hidden />
          : <CloudOff className="size-7 text-danger" aria-hidden />}
      </div>
      <p className="text-base font-semibold">{offline ? "اتصال اینترنت برقرار نیست." : title}</p>
      <p className="mt-1 max-w-xs text-sm leading-6 text-muted-foreground">
        {description ?? (offline ? "پس از اتصال مجدد، دوباره تلاش کنید." : "مشکلی در دریافت اطلاعات پیش آمد.")}
      </p>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry} className="mt-5 min-h-11 rounded-xl">
          <RefreshCcw className="size-4" aria-hidden />
          تلاش مجدد
        </Button>
      ) : null}
    </div>
  );
}

/* ── Skeletons (spec §45) ───────────────────────────────────── */

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-muted", className)} />;
}

export function LogCardSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <SkeletonBlock className="h-5 w-2/3" />
        <SkeletonBlock className="h-6 w-14" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <SkeletonBlock className="size-6 rounded-full" />
        <SkeletonBlock className="h-4 w-24" />
        <SkeletonBlock className="h-4 w-16" />
      </div>
    </div>
  );
}

export function LogListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <LogCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-4">
            <SkeletonBlock className="h-4 w-20" />
            <SkeletonBlock className="mt-3 h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border bg-card p-4">
        <SkeletonBlock className="h-5 w-32" />
        <SkeletonBlock className="mt-4 h-40 w-full" />
      </div>
    </div>
  );
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center py-16" role="status" aria-label="در حال بارگذاری">
      <RefreshCcw className="size-6 animate-spin text-primary" aria-hidden />
    </div>
  );
}

export function OfflineHint({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-warning/50 bg-warning-soft px-3 py-2 text-xs text-warning">
      <WifiOff className="size-4 shrink-0" aria-hidden />
      <span>
        در حالت آفلاین — {toPersianDigits(count)} گزارش روی دستگاه ذخیره شد و پس از اتصال ارسال می‌شود.
      </span>
    </div>
  );
}
