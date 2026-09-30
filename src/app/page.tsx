"use client";

import dynamic from "next/dynamic";
import { Timer } from "lucide-react";
import { AuthProvider } from "@/providers/auth-provider";
import { RouterProvider } from "@/navigation/router";

/** Inline splash — avoids loading the app bundle before first paint (spec §36/§65). */
function InlineSplash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background" aria-label="در حال بارگذاری">
      <div className="flex size-20 items-center justify-center rounded-[1.6rem] bg-primary text-primary-foreground shadow-xl shadow-primary/25">
        <Timer className="size-9" aria-hidden />
      </div>
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
