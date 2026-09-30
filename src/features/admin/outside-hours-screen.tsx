"use client";

/**
 * Outside Hours Report (spec §15) — per-person totals + ratio, day detail.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MoonStar } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DateRangeFilter, RangeValue } from "@/components/shared/date-range-filter";
import { StatCard } from "@/components/shared/stat-card";
import { UserChip } from "@/components/shared/time-log-card";
import { OutsideBadge } from "@/components/shared/status-badge";
import { StatsSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { adminApi } from "@/lib/api";
import { isoDate, presetRange, relativeDayLabel } from "@/lib/jalali";
import { minutesToHHMM } from "@/lib/duration";
import { toPersianDigits } from "@/lib/format";

export function OutsideHoursScreen() {
  const [range, setRange] = useState<RangeValue | null>(() => {
    const r = presetRange("thisMonth");
    return r ? { preset: "thisMonth", from: r.from, to: r.to } : null;
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  const fromIso = range ? isoDate(range.from) : undefined;
  const toIso = range ? isoDate(range.to) : undefined;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["outside-hours", fromIso, toIso],
    queryFn: () => adminApi.getOutsideHours(fromIso, toIso),
  });

  return (
    <div>
      <PageHeader title="خارج از ساعت اداری" subtitle="ثبت‌های خارج از ساعات کاری، آخر هفته و تعطیلات" />

      <div className="mb-4">
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      {isLoading ? (
        <StatsSkeleton />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : !data || data.rows.length === 0 ? (
        <EmptyState
          icon={MoonStar}
          title="در این بازه ثبت خارج از ساعت اداری وجود ندارد."
          description="همه گزارش‌ها داخل ساعات کاری ثبت شده‌اند."
        />
      ) : (
        <div className="space-y-4 pb-6">
          <StatCard label="مجموع خارج از ساعت اداری" value={data.total} icon={MoonStar} tone="outside" format={minutesToHHMM} hint={`${toPersianDigits(data.rows.length)} همکار`} />

          <section className="space-y-2.5">
            {data.rows.map((r) => {
              const ratio = r.totalMinutes > 0 ? Math.round((r.outsideMinutes / r.totalMinutes) * 100) : 0;
              const open = expanded === r.user.id;
              return (
                <div key={r.user.id} className="overflow-hidden rounded-2xl border bg-card app-shadow">
                  <button
                    onClick={() => setExpanded(open ? null : r.user.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-right"
                    aria-expanded={open}
                  >
                    <UserChip user={r.user} size="md" />
                    <div className="text-left">
                      <p className="text-sm font-bold nums text-outside">{minutesToHHMM(r.outsideMinutes)}</p>
                      <p className="text-[11px] text-muted-foreground nums">از {minutesToHHMM(r.totalMinutes)} کل ({toPersianDigits(ratio)}٪)</p>
                    </div>
                  </button>
                  {open ? (
                    <div className="space-y-2 border-t bg-muted/30 px-4 py-3">
                      {r.logs.slice(0, 10).map((log) => (
                        <div key={log.id} className="flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold">{log.description}</p>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-[11px] text-muted-foreground nums">{relativeDayLabel(log.workDate)}</span>
                              <OutsideBadge kind={log.outsideKind} size="xs" />
                            </div>
                          </div>
                          <span className="shrink-0 text-sm font-bold nums">{minutesToHHMM(log.originalDurationMinutes)}</span>
                        </div>
                      ))}
                      {r.logs.length > 10 ? (
                        <p className="pt-1 text-center text-[11px] text-muted-foreground nums">
                          و {toPersianDigits(r.logs.length - 10)} گزارش دیگر…
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>
        </div>
      )}
    </div>
  );
}
