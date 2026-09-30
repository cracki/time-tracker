"use client";

/**
 * OfflineIndicator + SyncStatus (spec §32–33) — real navigator.onLine,
 * draft count from IndexedDB, manual/online sync trigger.
 */

import { useCallback, useEffect, useState } from "react";
import { CloudUpload, RefreshCcw, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { draftApi } from "@/lib/api";
import { isSimOffline, onSimOfflineChange } from "@/lib/sim-offline";
import { useAuth } from "@/providers/auth-provider";
import { toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * navigator.onLine lies in some environments (in-app WebViews, preview
 * iframes, VPNs) — before trusting an offline report, confirm with a tiny
 * same-origin probe. Real offline fails the probe fast; lying environments
 * succeed, so the UI no longer shows a false "آفلاین" state.
 */
async function probeReachable(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch("/manifest.webmanifest", { method: "HEAD", cache: "no-store", signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export function useNetworkStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    let cancelled = false;
    let probing = false;

    const evaluate = async () => {
      if (isSimOffline() || !navigator.onLine) {
        if (probing) return; // one probe at a time
        probing = true;
        const reachable = await probeReachable();
        probing = false;
        if (!cancelled) setOnline(reachable && !isSimOffline());
      } else {
        setOnline(true);
      }
    };

    evaluate();
    window.addEventListener("online", evaluate);
    window.addEventListener("offline", evaluate);
    const off = onSimOfflineChange(evaluate);
    return () => {
      cancelled = true;
      window.removeEventListener("online", evaluate);
      window.removeEventListener("offline", evaluate);
      off();
    };
  }, []);
  return online;
}

/** Global slim banner shown under the header when offline. */
export function OfflineBanner() {
  const online = useNetworkStatus();
  if (online) return null;
  return (
    <div
      role="status"
      className="mx-4 mb-3 flex items-center justify-center gap-2 rounded-xl border border-warning/40 bg-warning-soft px-3 py-2 text-xs font-semibold text-warning md:mx-6"
    >
      <WifiOff className="size-4" aria-hidden />
      در حالت آفلاین هستید — تغییرات روی دستگاه ذخیره می‌شود
    </div>
  );
}

export function useDraftSync() {
  const { user } = useAuth();
  const online = useNetworkStatus();
  const [count, setCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setCount(await draftApi.listDrafts().then((d) => d.length));
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const sync = useCallback(async () => {
    if (!user || syncing || count === 0) return;
    setSyncing(true);
    try {
      const res = await draftApi.syncDrafts(user.id);
      if (res.synced > 0) toast.success(`${toPersianDigits(res.synced)} گزارش ذخیره‌شده ارسال شد.`);
      if (res.failed > 0) toast.error(`${toPersianDigits(res.failed)} گزارش ارسال نشد — بعداً تلاش کنید.`);
    } finally {
      setSyncing(false);
      void refresh();
    }
  }, [user, syncing, count, refresh]);

  // auto-sync when coming back online
  useEffect(() => {
    if (online && count > 0 && !syncing) void sync();
  }, [online, count, syncing, sync]);

  return { online, count, syncing, sync, refresh };
}

export function SyncStatusChip({ className }: { className?: string }) {
  const { online, count, syncing, sync } = useDraftSync();
  if (!online) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1.5 text-xs font-semibold text-warning", className)}>
        <WifiOff className="size-3.5" aria-hidden />
        آفلاین
      </span>
    );
  }
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={() => void sync()}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition-colors hover:bg-accent/70",
        className,
      )}
    >
      {syncing ? <RefreshCcw className="size-3.5 animate-spin" aria-hidden /> : <CloudUpload className="size-3.5" aria-hidden />}
      {syncing ? "در حال ارسال…" : `${toPersianDigits(count)} پیش‌نویس ارسال‌نشده`}
    </button>
  );
}

export function ConnectionPill() {
  const online = useNetworkStatus();
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold", online ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>
      {online ? <Wifi className="size-3.5" aria-hidden /> : <WifiOff className="size-3.5" aria-hidden />}
      {online ? "آنلاین" : "آفلاین"}
    </span>
  );
}
