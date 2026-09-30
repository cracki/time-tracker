"use client";

/**
 * Admin Dashboard (spec §18/§20) — KPI grid first, pending action,
 * charts after, recent pending logs with quick approve/reject.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle, ArrowLeft, CheckCircle2, Clock3, MoonStar,
  PenLine, Timer, TrendingUp, Users, XCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { StatCard } from "@/components/shared/stat-card";
import { TimeLogCard } from "@/components/shared/time-log-card";
import { LogListSkeleton, ErrorState } from "@/components/shared/states";
import { ChartCard, TrendChart, StatusDonutChart, PeopleComparisonChart } from "@/components/shared/charts";
import { adminApi, usersApi } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "@/navigation/router";
import { addDays, isoDate, today } from "@/lib/jalali";
import { minutesToHHMM } from "@/lib/duration";
import { toPersianDigits } from "@/lib/format";

export function AdminDashboardScreen() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => adminApi.getDashboard(isoDate(addDays(today(), -29)), isoDate(today())),
    enabled: !!user,
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.getAll(),
    enabled: !!user && user.role === "admin",
  });
  const userById = (id: string) => (users ?? []).find((u) => u.id === id);

  const quickApprove = async (id: string) => {
    if (!user) return;
    setBusyId(id);
    try {
      await adminApi.approve(user.id, id);
      void refetch();
      toast.success("گزارش تأیید شد.");
    } catch {
      toast.error("تأیید ناموفق بود.");
    } finally {
      setBusyId(null);
    }
  };

  const quickReject = async (id: string) => {
    if (!user) return;
    setBusyId(id);
    try {
      await adminApi.reject(user.id, id);
      void refetch();
      toast.success("گزارش رد شد.");
    } catch {
      toast.error("رد ناموفق بود.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <header className="-mx-4 mb-4 bg-gradient-to-b from-accent/70 to-background px-4 pb-5 pt-6 md:-mx-6 md:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="text-2xl font-extrabold leading-9">داشبورد تیم</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">وضعیت ثبت و تأیید زمان در ۳۰ روز اخیر</p>

          {/* Pending action card — primary admin action */}
          {isLoading ? (
            <Skeleton className="mt-4 h-16 rounded-2xl" />
          ) : data && data.pendingCount > 0 ? (
            <button
              onClick={() => navigate("/logs?status=pending")}
              className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-warning/40 bg-warning-soft px-4 py-3 text-right transition-transform active:scale-[0.99]"
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle className="size-5 shrink-0 text-warning" aria-hidden />
                <div>
                  <p className="text-sm font-bold text-warning">
                    {toPersianDigits(data.pendingCount)} گزارش در انتظار تأیید
                  </p>
                  <p className="text-[11px] text-warning/80 nums">مجموع {minutesToHHMM(data.pendingMinutes)}</p>
                </div>
              </div>
              <ArrowLeft className="size-4 shrink-0 text-warning" aria-hidden />
            </button>
          ) : (
            <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-success/40 bg-success-soft px-4 py-3">
              <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
              <p className="text-sm font-semibold text-success">همه گزارش‌ها بررسی شده‌اند 🎉</p>
            </div>
          )}
        </div>
      </header>

      <div className="space-y-5 pb-6">
        {/* KPI grid (spec §18) */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border bg-card p-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="mt-3 h-7 w-14" />
              </div>
            ))}
          </div>
        ) : isError || !data ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="کل ثبت‌شده" value={data.totalLogged} icon={Timer} tone="primary" format={minutesToHHMM} />
              <StatCard label="کل تأییدشده" value={data.totalApproved} icon={CheckCircle2} tone="success" format={minutesToHHMM} />
              <StatCard label="در انتظار" value={data.pendingMinutes} icon={Clock3} tone="warning" format={minutesToHHMM} hint={`${toPersianDigits(data.pendingCount)} گزارش`} onClick={() => navigate("/logs?status=pending")} />
              <StatCard label="اصلاح‌شده" value={data.adjustedMinutes} icon={PenLine} tone="adjusted" format={minutesToHHMM} hint={`${toPersianDigits(data.adjustedCount)} گزارش`} />
              <StatCard label="ردشده" value={data.rejectedMinutes} icon={XCircle} tone="danger" format={minutesToHHMM} />
              <StatCard label="خارج از ساعت اداری" value={data.outsideMinutes} icon={MoonStar} tone="outside" format={minutesToHHMM} onClick={() => navigate("/outside-hours")} />
              <StatCard label="افراد تیم" value={data.peopleCount} icon={Users} format={(v) => toPersianDigits(Math.round(v))} onClick={() => navigate("/people")} />
              <StatCard label="فعال امروز" value={data.activeToday} icon={TrendingUp} format={(v) => toPersianDigits(Math.round(v))} hint="ثبت گزارش امروز" />
            </div>

            {/* Charts (spec §21) — lazy-loaded below KPIs per mobile priority §20 */}
            <ChartCard title="روند زمان تیم" subtitle="۳۰ روز اخیر — ثبت‌شده در مقابل تأییدشده">
              <TrendChart data={data.trend} />
            </ChartCard>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="توزیع وضعیت‌ها" subtitle="بر اساس زمان">
                <StatusDonutChart data={data.statusDist} />
              </ChartCard>
              <ChartCard title="بیشترین زمان افراد" subtitle="۷ نفر برتر">
                <PeopleComparisonChart data={data.peopleTop.map((p) => ({ name: p.user.name, minutes: p.minutes }))} />
              </ChartCard>
            </div>

            {/* Recent pending */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold">
                  <Clock3 className="size-4 text-warning" aria-hidden />
                  آخرین‌های در انتظار تأیید
                </h2>
                <button onClick={() => navigate("/logs?status=pending")} className="flex min-h-9 items-center gap-1 text-xs font-bold text-primary">
                  همه
                  <ArrowLeft className="size-3.5" aria-hidden />
                </button>
              </div>
              {data.recentPending.length === 0 ? (
                <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
                  گزارش در انتظاری وجود ندارد.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.recentPending.map((log) => (
                    <TimeLogCard
                      key={log.id}
                      log={log}
                      showUser
                      user={userById(log.userId)}
                      onOpen={() => navigate(`/logs/${log.id}`)}
                      onApprove={() => void quickApprove(log.id)}
                      onReject={() => void quickReject(log.id)}
                      busy={busyId === log.id}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
