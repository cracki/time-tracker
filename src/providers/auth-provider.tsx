"use client";

/**
 * Auth session (real backend) — httpOnly cookie session created by
 * /api/auth/verify-otp. On mount the current user is fetched from
 * /api/auth/me; signOut destroys the server session.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { User } from "@/lib/types";
import { authApi } from "@/lib/api";
import { setSimOffline } from "@/lib/sim-offline";

interface AuthCtx {
  user: User | null;
  status: "loading" | "authed" | "guest";
  signIn: (user: User) => void;
  /** Merge a patch into the signed-in user (e.g. after avatar upload). */
  updateUser: (patch: Partial<User>) => void;
  signOut: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthCtx["status"]>("loading");

  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        setStatus(u ? "authed" : "guest");
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setStatus("guest");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback((u: User) => {
    setUser(u);
    setStatus("authed");
  }, []);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((u) => (u ? { ...u, ...patch } : u));
  }, []);

  const signOut = useCallback(() => {
    void authApi.logout();
    // Escape hatch: a leftover offline-simulation demo toggle (Account screen)
    // must never leak into the next session — it would keep showing the
    // offline banner / blocking log actions right after re-login.
    delete document.documentElement.dataset.simOffline;
    setSimOffline(false);
    setUser(null);
    setStatus("guest");
  }, []);

  return <Ctx.Provider value={{ user, status, signIn, updateUser, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
