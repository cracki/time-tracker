"use client";

/**
 * AppRoot — route gate + screen switch (single `/` route, hash router).
 * Auth guard per role (spec §3): admin routes need admin, collab needs collab.
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ErrorState } from "@/components/shared/states";
import { AppShell } from "@/components/shared/app-shell";
import { useRouter } from "@/navigation/router";
import { useAuth } from "@/providers/auth-provider";
import { LoginScreen } from "@/features/auth/login-screen";
import { OtpScreen } from "@/features/auth/otp-screen";
import { CollabHomeScreen } from "@/features/collab/home-screen";
import { MyLogsScreen } from "@/features/collab/my-logs-screen";
import { LogFormScreen } from "@/features/collab/log-form-screen";
import { LogDetailScreen } from "@/features/collab/log-detail-screen";
import { StatsScreen } from "@/features/collab/stats-screen";
import { AccountScreen } from "@/features/collab/account-screen";
import { AdminDashboardScreen } from "@/features/admin/admin-dashboard";
import { AdminLogsScreen } from "@/features/admin/admin-logs-screen";
import { PeopleScreen } from "@/features/admin/people-screen";
import { UsersScreen } from "@/features/admin/users-screen";
import { PersonSummaryScreen } from "@/features/admin/person-summary-screen";
import { ReportsScreen } from "@/features/admin/reports-screen";
import { OutsideHoursScreen } from "@/features/admin/outside-hours-screen";
import { CalendarScreen } from "@/features/admin/calendar-screen";
import { HolidaysScreen } from "@/features/admin/holidays-screen";
import { MoreScreen } from "@/features/admin/more-screen";

/** Splash / launch experience (spec §36) */
export function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background" aria-label="در حال بارگذاری">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" aria-hidden className="size-20 app-shadow" />
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="mt-5 text-xl font-extrabold"
      >
        زمان‌سنج
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="mt-1 text-xs text-muted-foreground"
      >
        ثبت سریع زمان کاری
      </motion.p>
    </div>
  );
}

const ADMIN_PATHS = new Set(["/people", "/users", "/reports", "/outside-hours", "/calendar", "/holidays", "/more"]);
const COLLAB_ONLY = new Set(["/stats"]);

function AppGate() {
  const { user, status } = useAuth();
  const { route, navigate } = useRouter();
  const [otpInfo, setOtpInfo] = useState<{ phone: string; devCode?: string; expiresAt: number } | null>(null);

  const path = route.path;

  // default redirect
  useEffect(() => {
    if (status === "guest" && path !== "/login" && path !== "/otp" && path !== "/about") {
      navigate("/login", { replace: true });
    }
    if (status === "authed" && (path === "/" || path === "/login" || path === "/otp")) {
      navigate("/home", { replace: true });
    }
  }, [status, path, navigate]);

  // clear OTP info when leaving otp
  useEffect(() => {
    if (path !== "/otp" && otpInfo && status === "guest") {
      // keep — back navigation to /otp keeps state
    }
  }, [path, otpInfo, status]);

  if (status === "loading") return <Splash />;

  if (status === "guest") {
    if (path === "/otp" && otpInfo) {
      return (
        <OtpScreen
          phone={otpInfo.phone}
          devCode={otpInfo.devCode}
          expiresAt={otpInfo.expiresAt}
          onBack={() => {
            setOtpInfo(null);
            navigate("/login", { replace: true });
          }}
          onResent={(info) => setOtpInfo((prev) => (prev ? { ...prev, ...info } : null))}
        />
      );
    }
    return <LoginScreen onSendCode={(phone) => {
      // import lazily to keep auth screen bundle small
      import("@/lib/api").then(({ authApi }) =>
        authApi.requestOtp(phone).then((info) => {
          setOtpInfo({ phone, ...info });
          navigate("/otp", { replace: false });
        }).catch((e) => {
          import("sonner").then(({ toast }) => toast.error(e?.message ?? "ارسال کد ناموفق بود."));
        }),
      );
    }} />;
  }

  // authed — role guard
  const isAdmin = user?.role === "admin";
  const isAdminPath = ADMIN_PATHS.has(path) || path.startsWith("/people/");
  const isCollabOnly = COLLAB_ONLY.has(path);

  if (isAdmin && isCollabOnly) {
    return <WrongRole message="این صفحه برای همکاران است." />;
  }
  if (!isAdmin && isAdminPath) {
    return <WrongRole message="این صفحه نیاز به دسترسی مدیر دارد." />;
  }

  return (
    <ScreenSwitch
      path={path}
      segments={route.segments}
      query={route.query}
      isAdmin={isAdmin}
      otpReset={() => setOtpInfo(null)}
    />
  );
}

function WrongRole({ message }: { message: string }) {
  const { user } = useAuth();
  const { navigate } = useRouter();
  return (
    <AppShell>
      <div className="pt-10">
        <ErrorState
          title="دسترسی ندارید"
          description={message}
        />
        <div className="flex justify-center">
          <button
            onClick={() => navigate("/home")}
            className="min-h-11 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground"
          >
            بازگشت به خانه — {user?.role === "admin" ? "داشبورد مدیر" : "خانه"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function ScreenSwitch({
  path,
  segments,
  isAdmin,
}: {
  path: string;
  segments: string[];
  query: Record<string, string>;
  isAdmin: boolean;
  otpReset: () => void;
}) {
  void isAdmin;
  const key = useMemo(() => segments.join("/"), [segments]);

  const screen = useMemo(() => {
    if (path === "/" || path === "/home") {
      return isAdmin ? <AdminDashboardScreen /> : <CollabHomeScreen />;
    }
    if (path === "/logs") return isAdmin ? <AdminLogsScreen /> : <MyLogsScreen />;
    if (path === "/logs/new") return <LogFormScreen />;
    if (segments[0] === "logs" && segments[1] && segments[2] === "edit") {
      return <LogFormScreen editId={segments[1]} />;
    }
    if (segments[0] === "logs" && segments[1]) return <LogDetailScreen logId={segments[1]} />;
    if (path === "/stats") return <StatsScreen />;
    if (path === "/account") return <AccountScreen />;
    if (path === "/people") return <PeopleScreen />;
    if (path === "/users") return <UsersScreen />;
    if (segments[0] === "people" && segments[1]) return <PersonSummaryScreen userId={segments[1]} />;
    if (path === "/reports") return <ReportsScreen />;
    if (path === "/outside-hours") return <OutsideHoursScreen />;
    if (path === "/calendar") return <CalendarScreen />;
    if (path === "/holidays") return <HolidaysScreen />;
    if (path === "/more") return <MoreScreen />;
    return <NotFound />;
  }, [path, segments, isAdmin]);

  return (
    <AppShell>
      <motion.div
        key={key}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        {screen}
      </motion.div>
    </AppShell>
  );
}

function NotFound() {
  return (
    <div className="pt-10">
      <ErrorState
        title="صفحه پیدا نشد"
        description="آدرس وارد شده معتبر نیست."
      />
    </div>
  );
}

export default function AppRoot() {
  return <AppGate />;
}
