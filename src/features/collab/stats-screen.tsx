"use client";

/**
 * Personal Statistics (spec §19/§21) — trend, status donut, heatmap,
 * outside-hours summary over selectable range.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CheckCircle2, MoonStar, Timer } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DateRangeFilter, RangeValue } from "@/components/shared/date-range-filter";
import { StatCard } from "@/components/shared/stat-card";
import { StatsSkeleton, ErrorState } from "@/components/shared/states";
import { ChartCard, TrendChart, StatusDonutChart, ActivityHeatmap } from "@/components/shared/charts";
import { collabApi } from "@/lib/api";
import { presetRange, isoDate, today } from "@/lib/jalali";
import { minutesToHHMM } from "@/lib/duration";
import { useAuth } from "@/providers/auth-provider";

export function StatsScreen() {
  const { user } = useAuth();
  const [range, setRange] = useState<RangeValue | null>(() => {
    const r = presetRange("thisMonth");
    return r ? { preset: "thisMonth", from: r.from, to: r.to } : null;
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-stats", user?.id, range ? [isoDate(range.from), isoDate(range.to)] : null],
    queryFn: () => collabApi.getMyStats(user!.id, isoDate(range!.from), isoDate(range!.to)),
    enabled: !!user && !!range,
  });

  return (
    <div>
      <PageHeader title="آمار من" subtitle="عملکرد شخصی در بازه انتخابی" />
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
            <StatCard label="کل ثبت‌شده" value={data.totalMinutes} icon={Timer} tone="primary" format={minutesToHHMM} />
            <StatCard label="تأییدشده" value={data.approvedMinutes} icon={CheckCircle2} tone="success" format={minutesToHHMM} />
            <StatCard label="خارج از ساعت اداری" value={data.outsideMinutes} icon={MoonStar} tone="outside" format={minutesToHHMM} />
            <StatCard label="تعداد گزارش" value={data.logCount} icon={BarChart3} format={(v) => `${Math.round(v)}`} />
          </div>

          <ChartCard title="روند زمان کاری" subtitle="ثبت‌شده در مقابل تأییدشده">
            <TrendChart data={data.byDay.map((d) => ({ date: d.date, logged: d.minutes, approved: d.approved }))} />
          </ChartCard>

          <ChartCard title="توزیع وضعیت‌ها">
            <StatusDonutChart data={data.statusDist} />
          </ChartCard>

          <ChartCard title="نقشه فعالیت" subtitle="شدت ثبت زمان در روزهای اخیر">
            <ActivityHeatmap data={data.byDay} />
          </ChartCard>
        </div>
      )}
    </div>
  );
}
