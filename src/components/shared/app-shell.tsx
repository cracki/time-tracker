"use client";

/**
 * AppShell (spec §40/§41) — mobile: sticky header + bottom nav + center FAB.
 * Desktop (lg+): right-side sidebar (RTL) instead of bottom nav.
 * Touch targets ≥44px (spec §42), safe-area aware.
 */

import { useEffect, useState } from "react";
import {
  BarChart3, CalendarClock, CalendarDays, Clock3, FileBarChart,
  Home, LayoutDashboard, LogOut, MoreHorizontal, Moon, Settings2, Sun, Timer, Users, WalletCards,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useRouter } from "@/navigation/router";
import { useAuth } from "@/providers/auth-provider";
import { Role } from "@/lib/types";
import { UserChip } from "./time-log-card";
import { OfflineBanner } from "./offline-banner";
import { Plus } from "lucide-react";
import { toast } from "sonner";

function usePwaInstaller() {
  const [promptEvent, setPromptEvent] = useState<{ prompt: () => Promise<void> } | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as unknown as { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  return {
    canInstall: !!promptEvent,
    install: async () => {
      if (promptEvent) {
        await promptEvent.prompt();
        setPromptEvent(null);
      }
    },
  };
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "حالت روشن" : "حالت تاریک"}
      className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {/* CSS-driven icon avoids hydration flash without mounted state */}
      <Sun className="hidden size-5 dark:block" aria-hidden />
      <Moon className="size-5 dark:hidden" aria-hidden />
    </button>
  );
}

interface NavItem {
  key: string;
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const COLLAB_NAV: NavItem[] = [
  { key: "home", path: "/home", label: "خانه", icon: Home },
  { key: "logs", path: "/logs", label: "زمان‌ها", icon: Clock3 },
  { key: "stats", path: "/stats", label: "آمار", icon: BarChart3 },
  { key: "account", path: "/account", label: "حساب", icon: MoreHorizontal },
];

const ADMIN_NAV: NavItem[] = [
  { key: "home", path: "/home", label: "خانه", icon: LayoutDashboard },
  { key: "logs", path: "/logs", label: "زمان‌ها", icon: Clock3 },
  { key: "people", path: "/people", label: "افراد", icon: Users },
  { key: "reports", path: "/reports", label: "گزارش‌ها", icon: FileBarChart },
  { key: "more", path: "/more", label: "بیشتر", icon: MoreHorizontal },
];

const ADMIN_MORE: NavItem[] = [
  { key: "calendar", path: "/calendar", label: "تقویم کاری", icon: CalendarClock },
  { key: "holidays", path: "/holidays", label: "تعطیلات", icon: CalendarDays },
  { key: "outside", path: "/outside-hours", label: "خارج از ساعت اداری", icon: Timer },
  { key: "account", path: "/account", label: "حساب کاربری", icon: Settings2 },
];

function isActive(route: string, path: string): boolean {
  if (path === "/home") return route === "/home";
  return route === path || route.startsWith(path + "/");
}

export function AppShell({
  children,
  fluid = false,
}: {
  children: React.ReactNode;
  fluid?: boolean;
}) {
  const { route, navigate } = useRouter();
  const { user, signOut } = useAuth();
  const role: Role = user?.role === "admin" ? "admin" : "collaborator";
  const nav = role === "admin" ? ADMIN_NAV : COLLAB_NAV;
  const routePath = route.path;

  const showFab = role === "collaborator";

  const handleSignOut = () => {
    signOut();
    toast.success("از حساب خارج شدید.");
  };

  return (
    <div className="min-h-dvh bg-background">
      {/* ── Desktop sidebar (lg+) ── */}
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-64 flex-col border-l bg-sidebar lg:flex">
        <div className="flex items-center gap-2.5 px-5 pb-4 pt-6">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Timer className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-base font-extrabold leading-6">زمان‌سنج</p>
            <p className="text-[11px] text-muted-foreground">ثبت و تأیید زمان تیم</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="ناوبری اصلی">
          {nav.map((item) => {
            const active = isActive(routePath, item.path);
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.path)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <item.icon className="size-5 shrink-0" aria-hidden />
                {item.label}
                {item.key === "more" && role === "admin" ? (
                  <span className="mr-auto text-[10px] text-muted-foreground/70">تقویم، تعطیلات…</span>
                ) : null}
              </button>
            );
          })}
          {role === "admin" ? (
            <div className="pt-3">
              <p className="px-3.5 pb-1 text-[11px] font-bold text-muted-foreground/70">مدیریت</p>
              {ADMIN_MORE.map((item) => {
                const active = isActive(routePath, item.path);
                return (
                  <button
                    key={item.key}
                    onClick={() => navigate(item.path)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <item.icon className="size-5 shrink-0" aria-hidden />
                    {item.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </nav>

        <div className="border-t p-3">
          {user ? (
            <div className="flex items-center gap-2 rounded-xl px-1.5 py-1">
              <UserChip user={user} size="md" />
              <div className="mr-auto flex items-center">
                <ThemeToggle />
                <button
                  type="button"
                  onClick={handleSignOut}
                  aria-label="خروج از حساب"
                  title="خروج"
                  className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger"
                >
                  <LogOut className="size-4.5" aria-hidden />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      {/* ── Content ── */}
      <div className="lg:mr-64">
        <OfflineBanner />
        <main className={cn("mx-auto w-full px-4 pb-28 md:px-6 lg:pb-10", !fluid && "max-w-5xl")}>
          {children}
        </main>

        {/* Desktop top-right quick actions for logged user */}
        {user ? (
          <div className="fixed left-6 top-5 z-40 hidden items-center gap-2 lg:flex">
            {role === "collaborator" ? (
              <button
                onClick={() => navigate("/logs/new")}
                className="flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg transition-transform active:scale-95"
              >
                <Plus className="size-4.5" aria-hidden />
                ثبت زمان
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/92 backdrop-blur-lg lg:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.25rem)" }}
        aria-label="ناوبری موبایل"
      >
        <div className="relative mx-auto grid max-w-lg grid-cols-5 px-2">
          {(nav.length === 4 ? [nav[0], nav[1], { key: "fab", path: "", label: "", icon: Plus }, nav[2], nav[3]] : [...nav]).map(
            (item: NavItem & { key: string }, idx: number) => {
              if (item.key === "fab") {
                return (
                  <button
                    key="fab"
                    onClick={() => navigate("/logs/new")}
                    aria-label="ثبت زمان جدید"
                    className="relative -top-5 mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-90"
                  >
                    <Plus className="size-6" aria-hidden />
                    <span className="sr-only">ثبت زمان</span>
                  </button>
                );
              }
              const active = isActive(routePath, item.path);
              return (
                <button
                  key={item.key}
                  onClick={() => navigate(item.path)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <item.icon className={cn("size-5.5", active && "drop-shadow")} aria-hidden />
                  {item.label}
                  {active ? <span className="absolute -bottom-0 h-1 w-6 rounded-full bg-primary" aria-hidden /> : null}
                </button>
              );
            },
          )}
        </div>
      </nav>
    </div>
  );
}

export { usePwaInstaller };
