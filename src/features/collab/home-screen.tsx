"use client";

/**
 * Collaborator Home (spec §19/§20) — KPI first, action, recent activity.
 * Reminder banner when nothing logged today (spec §31).
 */

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";
import {
  AlertCircle, ArrowLeft, CheckCircle2, Clock3, CalendarDays,
  History, Timer, TrendingUp, Wallet, MoonStar,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { TimeLogCard } from "@/components/shared/time-log-card";
import { LogListSkeleton, ErrorState, EmptyState } from "@/components/shared/states";
import { SyncStatusChip } from "@/components/shared/offline-banner";
import { collabApi } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "@/navigation/router";
import { formatJalali, today } from "@/lib/jalali";
import { minutesToHHMM } from "@/lib/duration";
import { toPersianDigits } from "@/lib/format";

export function CollabHomeScreen() {
  const { user } = useAuth();
  const { navigate } = useRouter();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-dashboard", user?.id],
    queryFn: () => collabApi.getMyDashboard(user!.id),
    enabled: !!user,
  });

  const firstName = user?.name.split(" ")[0] ?? "";
  const noLogsToday = data ? data.todayLogged === 0 : false;

  return (
    <div>
      {/* Greeting header */}
      <header className="-mx-4 mb-4 bg-gradient-to-b from-accent/70 to-background px-4 pb-5 pt-6 md:-mx-6 md:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{formatJalali(today(), "full")}</p>
              <h1 className="mt-0.5 text-2xl font-extrabold leading-9">سلام {firstName} 👋</h1>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <SyncStatusChip />
            </div>
          </div>

          {/* Reminder (spec §31) */}
          {isLoading ? (
            <Skeleton className="mt-4 h-16 rounded-2xl" />
          ) : noLogsToday ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-warning/40 bg-warning-soft px-4 py-3"
              role="status"
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle className="size-5 shrink-0 text-warning" aria-hidden />
                <p className="text-sm font-semibold text-warning">امروز هنوز زمان کاری ثبت نکرده‌اید.</p>
              </div>
              <Button size="sm" onClick={() => navigate("/logs/new")} className="h-10 shrink-0 rounded-xl bg-warning px-3.5 text-xs font-bold text-white hover:bg-warning/90">
                ثبت زمان
              </Button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-2.5 rounded-2xl border border-success/40 bg-success-soft px-4 py-3"
              role="status"
            >
              <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
              <p className="text-sm font-semibold text-success">
                امروز <span className="nums">{minutesToHHMM(data!.todayLogged)}</span> در {toPersianDigits(data!.todayCount)} گزارش ثبت شد — آفرین!
              </p>
            </motion.div>
          )}
        </div>
      </header>

      <div className="space-y-6">
        {/* KPI grid (spec §19) */}
        <section aria-label="خلاصه آمار">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl border bg-card p-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="mt-3 h-7 w-14" />
                </div>
              ))}
            </div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 gap-3 md:grid-cols-4"
            >
              <motion.div variants={staggerItem}>
                <StatCard label="زمان امروز" value={data!.todayLogged} icon={Timer} tone="primary" format={minutesToHHMM} onClick={() => navigate("/logs?preset=today")} />
              </motion.div>
              <motion.div variants={staggerItem}>
                <StatCard label="این هفته" value={data!.weekLogged} icon={CalendarDays} format={minutesToHHMM} onClick={() => navigate("/logs?preset=thisWeek")} />
              </motion.div>
              <motion.div variants={staggerItem}>
                <StatCard label="این ماه" value={data!.monthLogged} icon={TrendingUp} format={minutesToHHMM} onClick={() => navigate("/logs?preset=thisMonth")} />
              </motion.div>
              <motion.div variants={staggerItem}>
                <StatCard label="تأییدشده" value={data!.approvedMinutes} icon={CheckCircle2} tone="success" format={minutesToHHMM} onClick={() => navigate("/stats")} />
              </motion.div>
            </motion.div>
          )}
        </section>

        {/* Status chips row */}
        {!isLoading && !isError ? (
          <section className="grid grid-cols-3 gap-3" aria-label="وضعیت گزارش‌ها">
            <button onClick={() => navigate("/logs?status=pending")} className="flex flex-col items-center gap-1 rounded-2xl border bg-card py-3 transition-colors hover:border-warning/50">
              <span className="flex items-center gap-1.5 text-xs font-bold text-warning">
                <Clock3 className="size-3.5" aria-hidden /> در انتظار
              </span>
              <span className="text-base font-extrabold nums">{toPersianDigits(data!.pendingCount)}</span>
            </button>
            <button onClick={() => navigate("/logs?status=adjusted")} className="flex flex-col items-center gap-1 rounded-2xl border bg-card py-3 transition-colors hover:border-adjusted/50">
              <span className="flex items-center gap-1.5 text-xs font-bold text-adjusted">
                <Wallet className="size-3.5" aria-hidden /> اصلاح‌شده
              </span>
              <span className="text-base font-extrabold nums">{toPersianDigits(data!.adjustedCount)}</span>
            </button>
            <button onClick={() => navigate("/logs?outside=1")} className="flex flex-col items-center gap-1 rounded-2xl border bg-card py-3 transition-colors hover:border-outside/50">
              <span className="flex items-center gap-1.5 text-xs font-bold text-outside">
                <MoonStar className="size-3.5" aria-hidden /> خارج از اداری
              </span>
              <span className="text-base font-extrabold nums">{minutesToHHMM(data!.outsideMinutes)}</span>
            </button>
          </section>
        ) : null}

        {/* Recent activity */}
        <section aria-label="فعالیت اخیر">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <History className="size-4 text-primary" aria-hidden />
              آخرین گزارش‌ها
            </h2>
            <button
              onClick={() => navigate("/logs")}
              className="flex min-h-9 items-center gap-1 text-xs font-bold text-primary"
              aria-label="مشاهده همه گزارش‌ها"
            >
              همه
              <ArrowLeft className="size-3.5" aria-hidden />
            </button>
          </div>

          {isLoading ? (
            <LogListSkeleton count={3} />
          ) : isError ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : data!.recent.length === 0 ? (
            <EmptyState
              icon={History}
              title="هنوز زمانی ثبت نشده است."
              description="اولین گزارش خود را همین حالا ثبت کنید."
              action={
                <Button onClick={() => navigate("/logs/new")} className="h-11 rounded-xl px-5 font-bold">
                  + ثبت زمان
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {data!.recent.map((log) => (
                <TimeLogCard key={log.id} log={log} onOpen={() => navigate(`/logs/${log.id}`)} />
              ))}
            </div>
          )}
        </section>

        {/* Copy previous quick action (spec §30) */}
        {!isLoading && !isError && data!.lastLog ? (
          <button
            onClick={() => navigate(`/logs/new?copy=${data!.lastLog!.id}`)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-dashed border-primary/40 bg-accent/40 px-4 py-3.5 text-right transition-colors hover:bg-accent/70"
          >
            <div className="min-w-0">
              <p className="text-xs font-bold text-accent-foreground">تکرار آخرین گزارش</p>
              <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                {data!.lastLog.description} — <span className="nums">{minutesToHHMM(data!.lastLog.originalDurationMinutes)}</span>
              </p>
            </div>
            <ArrowLeft className="size-4 shrink-0 text-primary" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
