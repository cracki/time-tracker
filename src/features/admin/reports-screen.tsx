"use client";

/**
 * Reports (spec §15/§60/§61/§63) — Time & Outside-hours tabs,
 * original vs approved separation, printable report export (live data).
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, MoonStar, Timer, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DateRangeFilter, RangeValue } from "@/components/shared/date-range-filter";
import { StatCard } from "@/components/shared/stat-card";
import { UserChip } from "@/components/shared/time-log-card";
import { StatsSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ApiError, adminApi, reportsApi } from "@/lib/api";
import { printHtml } from "@/lib/print";
import { useRouter } from "@/navigation/router";
import { isoDate, presetRange, formatJalali } from "@/lib/jalali";
import { minutesToHHMM } from "@/lib/duration";
import { toPersianDigits } from "@/lib/format";

export function ReportsScreen() {
  const { navigate } = useRouter();
  const [tab, setTab] = useState("time");
  const [range, setRange] = useState<RangeValue | null>(() => {
    const r = presetRange("thisMonth");
    return r ? { preset: "thisMonth", from: r.from, to: r.to } : null;
  });
  const [pdfBusy, setPdfBusy] = useState(false);

  const fromIso = range ? isoDate(range.from) : undefined;
  const toIso = range ? isoDate(range.to) : undefined;

  const time = useQuery({
    queryKey: ["report-people", fromIso, toIso],
    queryFn: () => adminApi.getPeople("", fromIso, toIso, "most"),
    enabled: tab === "time",
  });

  const outside = useQuery({
    queryKey: ["outside-hours", fromIso, toIso],
    queryFn: () => adminApi.getOutsideHours(fromIso, toIso),
    enabled: tab === "outside",
  });

  const generatePdf = async () => {
    if (!range || !fromIso || !toIso) return;
    setPdfBusy(true);
    try {
      const html = await reportsApi.getPrintableReport(fromIso, toIso, tab === "outside" ? "outside" : "time");
      printHtml(html);
      toast.success(`گزارش ${formatJalali(range.from, "short")} تا ${formatJalali(range.to, "short")} آماده چاپ است — از منوی چاپ گزینه «ذخیره به‌صورت PDF» را انتخاب کنید.`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "تولید گزارش ناموفق بود.");
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="گزارش‌ها"
        actions={
          <Button size="sm" onClick={() => void generatePdf()} disabled={pdfBusy || !range} className="h-10 gap-1.5 rounded-xl px-3 text-xs font-bold">
            <FileDown className="size-4" aria-hidden />
            {pdfBusy ? "در حال ساخت…" : "گزارش PDF"}
          </Button>
        }
      />

      {range ? (
        <p className="mb-3 text-xs text-muted-foreground nums">
          بازه: {formatJalali(range.from, "long")} تا {formatJalali(range.to, "long")} — کاربر: همه
        </p>
      ) : null}

      <div className="mb-4">
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 grid h-11 w-full grid-cols-2 rounded-xl bg-muted p-1">
          <TabsTrigger value="time" className="rounded-lg text-[13px] font-bold data-[state=active]:bg-card">زمان تیم</TabsTrigger>
          <TabsTrigger value="outside" className="rounded-lg text-[13px] font-bold data-[state=active]:bg-card">خارج از ساعت اداری</TabsTrigger>
        </TabsList>

        {/* ── Time report ── */}
        <TabsContent value="time">
          {time.isLoading ? (
            <StatsSkeleton />
          ) : time.isError ? (
            <ErrorState onRetry={() => void time.refetch()} />
          ) : !time.data?.length ? (
            <EmptyState icon={Timer} title="برای این بازه داده‌ای وجود ندارد." />
          ) : (
            <div className="space-y-4 pb-6">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <StatCard label="مجموع ثبت‌شده" value={time.data.reduce((s, r) => s + r.totalLoggedMinutes, 0)} icon={Timer} tone="primary" format={minutesToHHMM} />
                <StatCard label="مجموع تأییدشده" value={time.data.reduce((s, r) => s + r.totalApprovedMinutes, 0)} icon={TrendingUp} tone="success" format={minutesToHHMM} />
                <StatCard label="اختلاف" value={time.data.reduce((s, r) => s + (r.totalLoggedMinutes - r.totalApprovedMinutes), 0)} tone="warning" format={minutesToHHMM} hint="Pending + اصلاحات" />
              </div>

              <section className="overflow-hidden rounded-2xl border bg-card app-shadow">
                <header className="border-b px-4 py-3 text-sm font-bold">جمع زمان هر فرد</header>
                <div className="divide-y">
                  {time.data.map((r) => (
                    <button
                      key={r.user.id}
                      onClick={() => navigate(`/people/${r.user.id}?from=${fromIso}&to=${toIso}`)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right transition-colors hover:bg-muted/50"
                    >
                      <UserChip user={r.user} size="md" />
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-muted-foreground">
                          ثبت: <b className="nums text-foreground">{minutesToHHMM(r.totalLoggedMinutes)}</b>
                        </span>
                        <span className="text-muted-foreground">
                          تأیید: <b className="nums text-success">{minutesToHHMM(r.totalApprovedMinutes)}</b>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}
        </TabsContent>

        {/* ── Outside hours report (spec §15) ── */}
        <TabsContent value="outside">
          {outside.isLoading ? (
            <StatsSkeleton />
          ) : outside.isError ? (
            <ErrorState onRetry={() => void outside.refetch()} />
          ) : !outside.data || outside.data.rows.length === 0 ? (
            <EmptyState icon={MoonStar} title="خارج از ساعت اداری ثبت نشده است." description="در این بازه هیچ گزارشی خارج از ساعات کاری ثبت نشده." />
          ) : (
            <div className="space-y-4 pb-6">
              <StatCard label="مجموع خارج از ساعت اداری تیم" value={outside.data.total} icon={MoonStar} tone="outside" format={minutesToHHMM} />

              <section className="overflow-hidden rounded-2xl border bg-card app-shadow">
                <header className="border-b px-4 py-3 text-sm font-bold">به تفکیک فرد</header>
                <div className="divide-y">
                  {outside.data.rows.map((r) => {
                    const ratio = r.totalMinutes > 0 ? Math.round((r.outsideMinutes / r.totalMinutes) * 100) : 0;
                    return (
                      <div key={r.user.id} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <UserChip user={r.user} size="md" />
                          <div className="text-left">
                            <p className="text-sm font-bold nums text-outside">{minutesToHHMM(r.outsideMinutes)}</p>
                            <p className="text-[11px] text-muted-foreground nums">
                              از {minutesToHHMM(r.totalMinutes)} کل ({toPersianDigits(ratio)}٪)
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-outside" style={{ width: `${ratio}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
