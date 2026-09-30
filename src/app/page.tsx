"use client";

import dynamic from "next/dynamic";
import { AuthProvider } from "@/providers/auth-provider";
import { RouterProvider } from "@/navigation/router";

/** Inline splash — avoids loading the app bundle before first paint (spec §36/§65). */
function InlineSplash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background" aria-label="در حال بارگذاری">
      <span className="relative inline-grid place-items-center">
        <span className="splash-ring" aria-hidden />
        <span className="splash-ring" aria-hidden />
        <img src="/logo.png" alt="" aria-hidden className="size-20 app-shadow" />
      </span>
      <p className="mt-5 text-xl font-extrabold">زمان‌سنج</p>
      <p className="mt-1 text-xs text-muted-foreground">ثبت سریع زمان کاری</p>
    </div>
  );
}

const AppRoot = dynamic(() => import("@/features/app-root"), {
  ssr: false,
  loading: () => <InlineSplash />,
});

export default function Home() {
  return (
    <RouterProvider>
      <AuthProvider>
        <AppRoot />
      </AuthProvider>
    </RouterProvider>
  );
}
