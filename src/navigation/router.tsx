"use client";

/**
 * Lightweight hash-based SPA router.
 * The sandbox serves only `/` — hash routing gives real deep-links,
 * back-button support and clean route separation within the single entry.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface RouteInfo {
  path: string;
  segments: string[];
  query: Record<string, string>;
}

function parseHash(hash: string): RouteInfo {
  let h = hash.replace(/^#/, "");
  if (!h || h === "/") h = "/";
  const [pathPart, queryPart] = h.split("?");
  const query: Record<string, string> = {};
  if (queryPart) {
    for (const pair of queryPart.split("&")) {
      const [k, v] = pair.split("=");
      if (k) query[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
    }
  }
  const path = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  return { path, segments: path.split("/").filter(Boolean), query };
}

interface RouterCtx {
  route: RouteInfo;
  navigate: (to: string, opts?: { replace?: boolean }) => void;
  back: () => void;
}

const Ctx = createContext<RouterCtx | null>(null);

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [hash, setHash] = useState<string>(() =>
    typeof window === "undefined" ? "/" : window.location.hash || "/",
  );

  useEffect(() => {
    const onChange = () => setHash(window.location.hash || "/");
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((to: string, opts?: { replace?: boolean }) => {
    const target = `#${to.startsWith("/") ? to : `/${to}`}`;
    if (window.location.hash === target) return;
    if (opts?.replace) {
      window.history.replaceState(null, "", target);
      setHash(target);
    } else {
      window.location.hash = target;
    }
  }, []);

  const back = useCallback(() => {
    if (window.history.length > 1) window.history.back();
    else navigate("/", { replace: true });
  }, [navigate]);

  const route = useMemo(() => parseHash(hash), [hash]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route.path]);

  return <Ctx.Provider value={{ route, navigate, back }}>{children}</Ctx.Provider>;
}

export function useRouter(): RouterCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRouter must be used within RouterProvider");
  return ctx;
}

/** Navigate back to fallback when current route is unauthorized/invalid. */
export function useRedirectWhen(cond: boolean, to: string) {
  const { navigate, route } = useRouter();
  useEffect(() => {
    if (cond) navigate(to, { replace: true });
  }, [cond, to, navigate, route.path]);
}
