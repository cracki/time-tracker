"use client";

/**
 * Person Summary (spec §76.19) — one person's KPIs, chart and logs
 * within the selected range.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock3, MoonStar, Timer, XCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DateRangeFilter, RangeValue } from "@/components/shared/date-range-filter";
import { StatCard } from "@/components/shared/stat-card";
import { StatsSkeleton, ErrorState } from "@/components/shared/states";
import { UserChip, TimeLogCard } from "@/components/shared/time-log-card";
import { ChartCard, TrendChart } from "@/components/shared/charts";
import { adminApi } from "@/lib/api";
import { useRouter } from "@/navigation/router";
import { isoDate, presetRange } from "@/lib/jalali";
import { minutesToHHMM } from "@/lib/duration";
import { toPersianDigits } from "@/lib/format";

export function PersonSummaryScreen({ userId }: { userId: string }) {
  const { navigate } = useRouter();
  const [range, setRange] = useState<RangeValue | null>(() => {
    const r = presetRange("thisWeek");
    return r ? { preset: "thisWeek", from: r.from, to: r.to } : null;
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["person", userId, range ? [isoDate(range.from), isoDate(range.to)] : null],
    queryFn: () => adminApi.getPersonSummary(userId, isoDate(range!.from), isoDate(range!.to)),
  });

  return (
    <div>
      <PageHeader title="خلاصه فرد" back />

      {data ? (
        <div className="mb-4 rounded-2xl border bg-card p-4 app-shadow">
          <UserChip user={data.summary.user} size="md" />
          {data.summary.user.role === "collaborator" ? (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {data.summary.user.managerName ? (
                <>مدیر: <b className="font-bold text-foreground">{data.summary.user.managerName}</b></>
              ) : (
                "بدون مدیر"
              )}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mb-4">
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      {isLoading ? (
        <StatsSkeleton />
      ) : isError || !data ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-4 pb-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="ثبت‌شده" value={data.summary.totalLoggedMinutes} icon={Timer} tone="primary" format={minutesToHHMM} />
            <StatCard label="تأییدشده" value={data.summary.totalApprovedMinutes} icon={CheckCircle2} tone="success" format={minutesToHHMM} />
            <StatCard label="در انتظار" value={data.summary.pendingMinutes} icon={Clock3} tone="warning" format={minutesToHHMM} />
            <StatCard label="خارج از اداری" value={data.summary.outsideMinutes} icon={MoonStar} tone="outside" format={minutesToHHMM} />
          </div>

          <ChartCard title="روند زمان" subtitle="ثبت‌شده در مقابل تأییدشده">
            <TrendChart data={data.byDay.map((d) => ({ date: d.date, logged: d.minutes, approved: d.approved }))} height={170} />
          </ChartCard>

          <section>
            <h2 className="mb-3 text-sm font-bold">گزارش‌های این بازه ({toPersianDigits(data.logs.length)})</h2>
            {data.logs.length === 0 ? (
              <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
                در این بازه گزارشی ثبت نشده است.
              </div>
            ) : (
              <div className="space-y-3">
                {data.logs.slice(0, 30).map((log) => (
                  <TimeLogCard key={log.id} log={log} onOpen={() => navigate(`/logs/${log.id}`)} />
                ))}
              </div>
            )}
          </section>

          {data.summary.rejectedMinutes > 0 ? (
            <div className="flex items-center gap-2 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-xs font-semibold text-danger">
              <XCircle className="size-4 shrink-0" aria-hidden />
              {toPersianDigits(minutesToHHMM(data.summary.rejectedMinutes))} از گزارش‌های این همکار رد شده است.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
