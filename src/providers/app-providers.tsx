"use client";

/**
 * App providers — Theme (next-themes), TanStack Query, Sonner toaster,
 * Service Worker registration with update UX (spec §34/§37).
 */

import { useEffect, useRef, useState } from "react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { toast } from "sonner";
import { RefreshCcw } from "lucide-react";

function ServiceWorkerMount() {
  const waitingRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // SW caching is production-only: dev chunks have stable URLs and
    // cache-first would freeze HMR (stale module bug).
    if (process.env.NODE_ENV !== "production") {
      // dev: clean up any previously registered SW + caches
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => void r.unregister());
      });
      caches?.keys().then((keys) => {
        keys.forEach((k) => void caches.delete(k));
      });
      return;
    }

    const swUrl = "/sw.js";

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register(swUrl);
        // If a worker is already waiting, offer update
        if (reg.waiting) {
          waitingRef.current = reg.waiting;
          showUpdateToast();
        }
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              waitingRef.current = installing;
              showUpdateToast();
            }
          });
        });

        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      } catch {
        /* SW optional in dev */
      }
    };

    const showUpdateToast = () => {
      toast("نسخه جدید آماده است.", {
        description: "برای اعمال بروزرسانی، ادامه دهید.",
        duration: Infinity,
        id: "sw-update",
        action: {
          label: "بروزرسانی",
          onClick: () => {
            waitingRef.current?.postMessage({ type: "SKIP_WAITING" });
          },
        },
        icon: <RefreshCcw className="size-4" aria-hidden />,
      });
    };

    register();
  }, []);

  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  useEffect(() => {
    // remove legacy SW caches on version bump handled in sw.js
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="top-center"
          dir="rtl"
          toastOptions={{
            style: {
              fontFamily: "Vazirmatn, sans-serif",
              borderRadius: "1rem",
            },
          }}
        />
        <ServiceWorkerMount />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
