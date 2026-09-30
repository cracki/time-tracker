"use client";

/**
 * Admin "More" (spec §41) — users management, calendar, holidays,
 * outside-hours, account.
 */

import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CalendarDays, ChevronLeft, Settings2, Timer, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { useRouter } from "@/navigation/router";
import { adminApi } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { toPersianDigits } from "@/lib/format";

export function MoreScreen() {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const isManager = user?.role === "manager";
  const { data: pendingData } = useQuery({
    queryKey: ["admin-pending-count"],
    queryFn: () => adminApi.getLogs({ status: "pending", pageSize: 1 }),
    refetchInterval: 60_000,
  });
  const pending = pendingData?.total ?? 0;

  const ALL_ITEMS = [
    { key: "users", path: "/users", title: "مدیریت کاربران", desc: "مدیران، همکاران و چیدمان تیم‌ها", icon: UsersRound, tone: "text-primary bg-accent", adminOnly: true },
    { key: "calendar", path: "/calendar", title: "تقویم کاری", desc: "روزها و ساعات کاری سازمان", icon: CalendarClock, tone: "text-primary bg-accent", adminOnly: true },
    { key: "holidays", path: "/holidays", title: "تعطیلات رسمی", desc: "ورود تعطیلات سالانه", icon: CalendarDays, tone: "text-danger bg-danger-soft", adminOnly: true },
    { key: "outside", path: "/outside-hours", title: "خارج از ساعت اداری", desc: "گزارش ثبت‌های خارج از ساعات کاری", icon: Timer, tone: "text-outside bg-outside-soft", adminOnly: false },
    { key: "account", path: "/account", title: "حساب کاربری", desc: "ظاهر، نصب، پیش‌نویس‌ها و خروج", icon: Settings2, tone: "text-muted-foreground bg-muted", adminOnly: false },
  ];
  const ITEMS = ALL_ITEMS.filter((i) => !i.adminOnly || !isManager);

  return (
    <div>
      <PageHeader title="بیشتر" subtitle={isManager ? "ابزارهای تیم شما" : "ابزارهای مدیریتی"} />
      <div className="space-y-2.5 pb-6">
        {ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => navigate(item.path)}
            className="flex w-full items-center gap-3.5 rounded-2xl border bg-card p-4 text-right app-shadow transition-colors hover:border-primary/35 active:bg-accent/30"
          >
            <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${item.tone}`}>
              <item.icon className="size-5.5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold">{item.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{item.desc}</span>
            </span>
            <ChevronLeft className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        ))}

        {pending > 0 ? (
          <button
            onClick={() => navigate("/logs?status=pending")}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-warning/40 bg-warning-soft px-4 py-3.5 text-right"
          >
            <span className="text-sm font-bold text-warning">
              {toPersianDigits(pending)} گزارش در انتظار تأیید
            </span>
            <ChevronLeft className="size-4 text-warning" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
