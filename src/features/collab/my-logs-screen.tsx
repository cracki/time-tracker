"use client";

/**
 * My Logs (spec §24/§25) — grouped by Jalali day, sticky day headers,
 * status/outside/range filters, pull from query params (home shortcuts).
 */

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock3, LayoutList, Rows3 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DateRangeFilter, RangeValue } from "@/components/shared/date-range-filter";
import { TimeLogCard } from "@/components/shared/time-log-card";
import { VirtualLogList, buildGroupedVirtualItems } from "@/components/shared/log-list";
import { LogListSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { collabApi } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "@/navigation/router";
import { presetRange, isoDate, parseIso, relativeDayLabel } from "@/lib/jalali";
import { minutesToHHMM } from "@/lib/duration";
import { toPersianDigits } from "@/lib/format";
import { TimeLogStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_TABS: { key: TimeLogStatus | "all"; label: string }[] = [
  { key: "all", label: "همه" },
  { key: "pending", label: "در انتظار" },
  { key: "approved", label: "تأییدشده" },
  { key: "adjusted", label: "اصلاح‌شده" },
  { key: "rejected", label: "ردشده" },
];

type Density = "compact" | "cards";
const DENSITY_KEY = "tt-log-density";

export function MyLogsScreen() {
  const { user } = useAuth();
  const { route, navigate } = useRouter();
  const qcStatus = (route.query.status as TimeLogStatus) || "all";
  const qcOutside = route.query.outside === "1";

  const [status, setStatus] = useState<TimeLogStatus | "all">(qcStatus);
  const [outsideOnly, setOutsideOnly] = useState(qcOutside);
  const [density, setDensity] = useState<Density>(() => {
    if (typeof window === "undefined") return "compact";
    return (localStorage.getItem(DENSITY_KEY) as Density) || "compact";
  });
  const [range, setRange] = useState<RangeValue | null>(() => {
    const preset = route.query.preset;
    if (preset) {
      const r = presetRange(preset);
      if (r) return { preset, from: r.from, to: r.to };
    }
    return null;
  });

  const toggleDensity = () => {
    setDensity((d) => {
      const next = d === "compact" ? "cards" : "compact";
      localStorage.setItem(DENSITY_KEY, next);
      return next;
    });
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-logs", user?.id, status, outsideOnly, range ? [isoDate(range.from), isoDate(range.to)] : null],
    queryFn: () =>
      collabApi.getMyLogs(user!.id, {
        status: status === "all" ? null : status,
        outsideOnly,
        from: range ? isoDate(range.from) : undefined,
        to: range ? isoDate(range.to) : undefined,
      }),
    enabled: !!user,
  });

  const groups = useMemo(() => {
    if (!data) return [];
    const byDate = new Map<string, typeof data>();
    for (const log of data) {
      const arr = byDate.get(log.workDate) ?? [];
      arr.push(log);
      byDate.set(log.workDate, arr);
    }
    return Array.from(byDate.entries()).map(([date, logs]) => ({
      date,
      logs,
      total: logs.reduce((s, l) => s + l.originalDurationMinutes, 0),
    }));
  }, [data]);

  const totalMinutes = data?.reduce((s, l) => s + l.originalDurationMinutes, 0) ?? 0;

  const openLog = useCallback((id: string) => navigate(`/logs/${id}`), [navigate]);
  const editLog = useCallback((id: string) => navigate(`/logs/${id}/edit`), [navigate]);

  const virtualItems = useMemo(
    () => buildGroupedVirtualItems(groups, (log) => ({ kind: "log", key: log.id, log, onOpen: () => openLog(log.id), onEdit: () => editLog(log.id) })),
    [groups, openLog, editLog],
  );

  return (
    <div>
      <PageHeader
        title="زمان‌های من"
        subtitle={data ? `${toPersianDigits(data.length)} گزارش • مجموع ${minutesToHHMM(totalMinutes)}` : undefined}
        actions={
          data && data.length > 0 ? (
            <button
              type="button"
              onClick={toggleDensity}
              aria-label={density === "compact" ? "نمایش کارتی" : "نمایش فشرده"}
              title={density === "compact" ? "نمایش کارتی" : "نمایش فشرده"}
              className="flex size-10 items-center justify-center rounded-xl border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {density === "compact" ? <LayoutList className="size-4.5" aria-hidden /> : <Rows3 className="size-4.5" aria-hidden />}
            </button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="mb-4 space-y-3">
        <DateRangeFilter value={range} onChange={setRange} />
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:-mx-6 md:px-6" role="tablist" aria-label="وضعیت">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={status === t.key}
              onClick={() => setStatus(t.key)}
              className={cn(
                "min-h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
                status === t.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {t.label}
            </button>
          ))}
          <button
            role="tab"
            aria-selected={outsideOnly}
            onClick={() => setOutsideOnly((v) => !v)}
            className={cn(
              "min-h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
              outsideOnly
                ? "border-outside bg-outside-soft text-outside"
                : "border-input bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            خارج از ساعت اداری
          </button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <LogListSkeleton count={6} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={Clock3}
          title="برای این فیلتر زمانی پیدا نشد."
          description="بازه یا فیلترهای دیگری را امتحان کنید."
          action={
            <button onClick={() => navigate("/logs/new")} className="min-h-11 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">
              + ثبت زمان
            </button>
          }
        />
      ) : density === "compact" ? (
        <VirtualLogList items={virtualItems} ariaLabel="فهرست گزارش‌ها" />
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <section key={g.date} aria-label={g.date}>
              <div className="flex items-center justify-between px-1 py-1.5">
                <span className="text-sm font-bold">{relativeDayLabel(g.date)}</span>
                <span className="text-xs text-muted-foreground nums">
                  {toPersianDigits(g.logs.length)} گزارش • {minutesToHHMM(g.total)}
                </span>
              </div>
              <div className="space-y-3 pt-1">
                {g.logs.map((log) => (
                  <TimeLogCard
                    key={log.id}
                    log={log}
                    onOpen={() => openLog(log.id)}
                    onEdit={() => editLog(log.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
