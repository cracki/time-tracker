"use client";

/**
 * Admin Time Logs (spec §24–§28) — full filters (range, user, status,
 * outside, day type), mobile cards / desktop table, quick actions.
 */

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FilterX, LayoutList, Rows3, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DateRangeFilter, RangeValue } from "@/components/shared/date-range-filter";
import { TimeLogCard } from "@/components/shared/time-log-card";
import { VirtualLogList, VirtualItem } from "@/components/shared/log-list";
import { LogListSkeleton, EmptyState, ErrorState, PageSpinner } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { LogActions, AdminAction } from "@/components/shared/log-actions";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminApi, usersApi } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "@/navigation/router";
import { presetRange, isoDate, formatJalali } from "@/lib/jalali";
import { minutesToHHMM } from "@/lib/duration";
import { toPersianDigits } from "@/lib/format";
import { TimeLogStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: { key: TimeLogStatus | "all"; label: string }[] = [
  { key: "all", label: "همه وضعیت‌ها" },
  { key: "pending", label: "در انتظار تأیید" },
  { key: "approved", label: "تأیید شده" },
  { key: "adjusted", label: "اصلاح شده" },
  { key: "rejected", label: "رد شده" },
];

const DAY_TYPES = [
  { key: "all", label: "همه روزها" },
  { key: "workday", label: "روز کاری" },
  { key: "weekend", label: "آخر هفته" },
  { key: "holiday", label: "تعطیل رسمی" },
];

export function AdminLogsScreen() {
  const { user } = useAuth();
  const isManager = user?.role === "manager";
  const { route, navigate } = useRouter();

  const initialStatus = (route.query.status as TimeLogStatus) || "all";
  const initialPreset = route.query.preset;

  const [status, setStatus] = useState<TimeLogStatus | "all">(initialStatus);
  const [userFilter, setUserFilter] = useState<string>("all");
  const [outsideOnly, setOutsideOnly] = useState(route.query.outside === "1");
  const [dayType, setDayType] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [action, setAction] = useState<AdminAction>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [density, setDensity] = useState<"compact" | "cards">(() => {
    if (typeof window === "undefined") return "compact";
    return (localStorage.getItem("tt-log-density") as "compact" | "cards") || "compact";
  });
  const [range, setRange] = useState<RangeValue | null>(() => {
    if (initialPreset) {
      const r = presetRange(initialPreset);
      if (r) return { preset: initialPreset, from: r.from, to: r.to };
    }
    return null;
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-logs", status, userFilter, outsideOnly, dayType, range ? [isoDate(range.from), isoDate(range.to)] : null],
    queryFn: () =>
      adminApi.getLogs({
        status: status === "all" ? null : status,
        userId: userFilter === "all" ? null : userFilter,
        outsideOnly,
        dayType: dayType as "all" | "workday" | "holiday" | "weekend",
        from: range ? isoDate(range.from) : undefined,
        to: range ? isoDate(range.to) : undefined,
        pageSize: 200,
      }),
    enabled: !!user && user.role === "admin",
  });

  const { data: users } = useQuery({
    queryKey: ["filter-users", user?.role],
    queryFn: async () => {
      if (user?.role === "manager") {
        const people = await adminApi.getPeople("");
        return people.map((p) => p.user);
      }
      return usersApi.getAll();
    },
    enabled: !!user && (user.role === "admin" || user.role === "manager"),
  });
  const userById = useMemo(() => {
    const m = new Map((users ?? []).map((u) => [u.id, u]));
    return (id: string) => m.get(id);
  }, [users]);

  const [target, setTarget] = useState<{ log: NonNullable<typeof data>["items"][number]; kind: "adjust" | "reject" } | null>(null);

  const approve = useCallback(
    async (id: string) => {
      if (!user) return;
      setBusyId(id);
      try {
        await adminApi.approve(user.id, id);
        toast.success("گزارش تأیید شد.");
        void refetch();
      } catch {
        toast.error("تأیید ناموفق بود.");
      } finally {
        setBusyId(null);
      }
    },
    [user, refetch],
  );

  const openLog = useCallback((id: string) => navigate(`/logs/${id}`), [navigate]);

  const mobileItems: VirtualItem[] = useMemo(
    () =>
      (data?.items ?? []).map((log) => ({
        kind: "log" as const,
        key: log.id,
        log,
        showUser: true,
        user: userById(log.userId),
        onOpen: () => openLog(log.id),
        onApprove: isManager && log.status === "pending" ? () => void approve(log.id) : undefined,
        onReject: isManager && log.status === "pending" ? () => setTarget({ log, kind: "reject" }) : undefined,
        busy: busyId === log.id,
      })),
    [data, userById, openLog, approve, busyId],
  );

  const activeFilters = [status !== "all", userFilter !== "all", outsideOnly, dayType !== "all", !!range].filter(Boolean).length;

  return (
    <div>
      <PageHeader
        title={isManager ? "زمان‌های تیم من" : "زمان‌های تیم"}
        subtitle={data ? `${toPersianDigits(data.total)} گزارش` : undefined}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDensity((d) => {
                  const next = d === "compact" ? "cards" : "compact";
                  localStorage.setItem("tt-log-density", next);
                  return next;
                });
              }}
              aria-label={density === "compact" ? "نمایش کارتی" : "نمایش فشرده"}
              title={density === "compact" ? "نمایش کارتی" : "نمایش فشرده"}
              className="flex size-10 items-center justify-center rounded-xl border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            >
              {density === "compact" ? <LayoutList className="size-4.5" aria-hidden /> : <Rows3 className="size-4.5" aria-hidden />}
            </button>
            <Button
              variant="outline"
              size="sm"
              className={cn("h-10 gap-1.5 rounded-xl px-3 text-xs font-bold", activeFilters > 0 && "border-primary/50 text-primary")}
              onClick={() => setFilterOpen(true)}
            >
              <SlidersHorizontal className="size-4" aria-hidden />
              فیلترها
              {activeFilters > 0 ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground nums">
                  {toPersianDigits(activeFilters)}
                </span>
              ) : null}
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      {isLoading ? (
        <LogListSkeleton count={6} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={FilterX}
          title="برای این فیلتر زمانی پیدا نشد."
          description="فیلترها را تغییر دهید یا بازه دیگری انتخاب کنید."
        />
      ) : (
        <>
          {/* Mobile: virtualized list (compact rows by default) */}
          <div className="lg:hidden">
            {density === "compact" ? (
              <VirtualLogList items={mobileItems} ariaLabel="فهرست گزارش‌های تیم" />
            ) : (
              <div className="space-y-3">
                {data.items.map((log) => (
                  <TimeLogCard
                    key={log.id}
                    log={log}
                    showUser
                    user={userById(log.userId)}
                    onOpen={() => navigate(`/logs/${log.id}`)}
                    onApprove={isManager && log.status === "pending" ? () => void approve(log.id) : undefined}
                    onReject={isManager && log.status === "pending" ? () => setTarget({ log, kind: "reject" }) : undefined}
                    busy={busyId === log.id}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Desktop: table (spec §26) */}
          <div className="hidden overflow-x-auto rounded-2xl border bg-card app-shadow thin-scrollbar lg:block">
            <Table className="min-w-[880px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-right">تاریخ</TableHead>
                  <TableHead className="text-right">کاربر</TableHead>
                  <TableHead className="text-right">توضیحات</TableHead>
                  <TableHead className="text-center">ثبت‌شده</TableHead>
                  <TableHead className="text-center">تأییدشده</TableHead>
                  <TableHead className="text-center">وضعیت</TableHead>
                  <TableHead className="text-center">خارج از اداری</TableHead>
                  <TableHead className="text-center">اقدامات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((log) => {
                  const u = userById(log.userId);
                  return (
                    <TableRow key={log.id} className="cursor-pointer" onClick={() => navigate(`/logs/${log.id}`)}>
                      <TableCell className="whitespace-nowrap text-xs nums">{formatJalali(log.workDate, "short")}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{u?.name ?? "—"}</TableCell>
                      <TableCell className="max-w-56 truncate text-xs">{log.description}</TableCell>
                      <TableCell className="text-center text-xs font-bold nums">{minutesToHHMM(log.originalDurationMinutes)}</TableCell>
                      <TableCell className="text-center text-xs font-bold nums">{log.approvedDurationMinutes != null ? minutesToHHMM(log.approvedDurationMinutes) : "—"}</TableCell>
                      <TableCell className="text-center"><StatusBadge status={log.status} size="xs" /></TableCell>
                      <TableCell className="text-center text-[11px]">{log.outsideKind !== "normal" ? toPersianDigits("✓") : "—"}</TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        {isManager && log.status === "pending" ? (
                          <div className="flex items-center justify-center gap-1">
                            <Button size="sm" onClick={() => void approve(log.id)} disabled={busyId === log.id} className="h-8 rounded-lg bg-success px-2.5 text-[11px] font-bold text-white hover:bg-success/90">
                              تأیید
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setTarget({ log, kind: "adjust" })} className="h-8 rounded-lg px-2.5 text-[11px] font-bold">
                              اصلاح
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setTarget({ log, kind: "reject" })} className="h-8 rounded-lg border-danger/40 px-2.5 text-[11px] font-bold text-danger hover:bg-danger-soft">
                              رد
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">{isManager ? "—" : "ملاحظه"}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Filter drawer */}
      <Drawer open={filterOpen} onOpenChange={setFilterOpen}>
        <DrawerContent className="mx-auto max-w-md">
          <DrawerHeader>
            <DrawerTitle className="text-center text-base font-bold">فیلتر گزارش‌ها</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4 px-6 pb-2">
            <div>
              <Label className="mb-1.5 block text-sm font-semibold">کاربر</Label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="h-11 w-full rounded-xl bg-card">
                  <SelectValue placeholder="همه کاربران" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه کاربران</SelectItem>
                  {(users ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm font-semibold">وضعیت</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TimeLogStatus | "all")}>
                <SelectTrigger className="h-11 w-full rounded-xl bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm font-semibold">نوع روز</Label>
              <Select value={dayType} onValueChange={setDayType}>
                <SelectTrigger className="h-11 w-full rounded-xl bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_TYPES.map((d) => (
                    <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-xl border px-4 py-3">
              <Label htmlFor="outside-f" className="text-sm font-semibold">فقط خارج از ساعت اداری</Label>
              <Switch id="outside-f" checked={outsideOnly} onCheckedChange={setOutsideOnly} />
            </div>
          </div>
          <div className="flex gap-2 px-6 pb-6 pt-3 safe-bottom">
            <Button
              variant="outline"
              className="h-12 flex-1 rounded-xl"
              onClick={() => {
                setUserFilter("all");
                setStatus("all");
                setDayType("all");
                setOutsideOnly(false);
              }}
            >
              پاک کردن
            </Button>
            <Button className="h-12 flex-1 rounded-xl font-bold" onClick={() => setFilterOpen(false)}>
              اعمال
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Pending action sheets — decisions are managers-only */}
      {target && isManager ? (
        <LogActions
          log={target.log}
          open={target.kind === "reject" ? "reject" : "adjust"}
          onOpenChange={(a) => {
            if (!a) {
              setTarget(null);
              void refetch();
            }
          }}
          busyId={busyId}
          setBusyId={setBusyId}
        />
      ) : null}
    </div>
  );
}
