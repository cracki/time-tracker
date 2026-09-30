"use client";

/**
 * People (spec §23/§62) — per-person totals with range presets and sorting.
 * No "performance score" — raw real data only (spec §62).
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, ChevronLeft, Users, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DateRangeFilter, RangeValue } from "@/components/shared/date-range-filter";
import { UserChip } from "@/components/shared/time-log-card";
import { LogListSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { adminApi } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/navigation/router";
import { isoDate, presetRange } from "@/lib/jalali";
import { minutesToHHMM } from "@/lib/duration";
import { toPersianDigits } from "@/lib/format";

type SortKey = "most" | "least" | "mostApproved" | "mostOutside";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "most", label: "بیشترین زمان" },
  { key: "least", label: "کمترین زمان" },
  { key: "mostApproved", label: "بیشترین زمان تأییدشده" },
  { key: "mostOutside", label: "بیشترین خارج از ساعت" },
];

export function PeopleScreen() {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const isManager = user?.role === "manager";
  const [range, setRange] = useState<RangeValue | null>(() => {
    const r = presetRange("thisWeek");
    return r ? { preset: "thisWeek", from: r.from, to: r.to } : null;
  });
  const [sort, setSort] = useState<SortKey>("most");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["people", range ? [isoDate(range.from), isoDate(range.to)] : null, sort],
    queryFn: () => adminApi.getPeople("", isoDate(range!.from), isoDate(range!.to), sort),
  });

  return (
    <div>
      <PageHeader
        title={isManager ? "افراد من" : "افراد تیم"}
        subtitle={data ? `${toPersianDigits(data.length)} همکار` : undefined}
        actions={
          !isManager ? (
            <Button
              variant="outline"
              size="icon"
              aria-label="مدیریت کاربران"
              onClick={() => navigate("/users")}
              className="size-10 rounded-xl"
            >
              <UsersRound className="size-4.5" aria-hidden />
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 space-y-3">
        <DateRangeFilter value={range} onChange={setRange} />
        <div className="flex items-center gap-2">
          <ArrowUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-10 flex-1 rounded-xl bg-card text-[13px]" aria-label="ترتیب">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <LogListSkeleton count={5} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : !data || data.length === 0 ? (
        <EmptyState icon={Users} title="همکاری برای نمایش وجود ندارد." />
      ) : (
        <div className="space-y-2.5 pb-6">
          {data.map((s) => (
            <button
              key={s.user.id}
              onClick={() => navigate(`/people/${s.user.id}?from=${isoDate(range!.from)}&to=${isoDate(range!.to)}`)}
              className="flex w-full items-center gap-3 rounded-2xl border bg-card p-3.5 text-right app-shadow transition-colors hover:border-primary/35 active:bg-accent/30"
              aria-label={`مشاهده خلاصه ${s.user.name}`}
            >
              <div className="min-w-0 flex-1">
                <UserChip user={s.user} size="md" />
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  {s.user.managerName ? <span>مدیر: <b className="font-bold text-foreground">{s.user.managerName}</b></span> : null}
                  <span>ثبت‌شده: <b className="nums text-foreground">{minutesToHHMM(s.totalLoggedMinutes)}</b></span>
                  <span>تأییدشده: <b className="nums text-success">{minutesToHHMM(s.totalApprovedMinutes)}</b></span>
                  <span>در انتظار: <b className="nums text-warning">{minutesToHHMM(s.pendingMinutes)}</b></span>
                  {s.outsideMinutes > 0 ? (
                    <span>خارج از اداری: <b className="nums text-outside">{minutesToHHMM(s.outsideMinutes)}</b></span>
                  ) : null}
                </div>
              </div>
              <ChevronLeft className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
