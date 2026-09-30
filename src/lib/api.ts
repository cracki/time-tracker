/**
 * API client (spec §87) — single central service layer over the real
 * Next.js API routes (cookie sessions).
 *
 * - Simulated-offline demo (Account screen) still short-circuits here.
 * - Real network failures map to code "offline" so the offline-draft
 *   flow keeps working with the real backend.
 * - Auth identity comes from the session cookie; userId params are kept
 *   only for interface compatibility and ignored by the server.
 */

import { offlineDrafts } from "./offline-drafts";
import { isSimOffline } from "./sim-offline";
import {
  CalendarSettings, Holiday, LogDraft, LogsFilter, TimeLog, TimeLogStatus, User, UserSummary,
} from "./types";

export class ApiError extends Error {
  constructor(message: string, public code: "offline" | "validation" | "forbidden" | "not_found" | "server" = "server") {
    super(message);
    this.name = "ApiError";
  }
}

export const CONFIG = { backdateLimitDays: 3, otpLength: 5, otpTtlSec: 120, resendCooldownSec: 30, maxAttempts: 3 };

/* ── transport ──────────────────────────────────────────────── */

function assertOnline() {
  if (isSimOffline()) {
    throw new ApiError("در حالت آفلاین (شبیه‌سازی‌شده) هستید — پس از اتصال همگام‌سازی می‌شود.", "offline");
  }
}

type ReqInit = Omit<RequestInit, "body"> & { json?: unknown };

async function request<T>(path: string, init: ReqInit = {}): Promise<T> {
  assertOnline();
  let res: Response;
  try {
    const { json, ...rest } = init;
    res = await fetch(path, {
      ...rest,
      ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("ارتباط با سرور برقرار نشد.", "offline");
  }
  if (res.ok) {
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
  let message = "خطا در ارتباط با سرور.";
  let code: ApiError["code"] = "server";
  try {
    const data = (await res.json()) as { error?: string; code?: string };
    if (data?.error) message = data.error;
    if (data?.code === "unauthorized") code = "forbidden";
    else if (data?.code && ["validation", "forbidden", "not_found", "offline", "server"].includes(data.code)) {
      code = data.code as ApiError["code"];
    }
  } catch { /* non-JSON error body */ }
  throw new ApiError(message, code);
}

const get = <T,>(path: string) => request<T>(path);
const post = <T,>(path: string, json: unknown) => request<T>(path, { method: "POST", json });
const put = <T,>(path: string, json: unknown) => request<T>(path, { method: "PUT", json });
const del = <T,>(path: string) => request<T>(path, { method: "DELETE" });

/** Same transport rules as request(), but the server answers text/html (print report). */
async function requestText(path: string): Promise<string> {
  assertOnline();
  let res: Response;
  try {
    res = await fetch(path, { cache: "no-store" });
  } catch {
    throw new ApiError("ارتباط با سرور برقرار نشد.", "offline");
  }
  if (res.ok) return res.text();
  let message = "خطا در ارتباط با سرور.";
  let code: ApiError["code"] = "server";
  try {
    const data = (await res.json()) as { error?: string; code?: string };
    if (data?.error) message = data.error;
    if (data?.code === "unauthorized") code = "forbidden";
    else if (data?.code && ["validation", "forbidden", "not_found", "offline", "server"].includes(data.code)) {
      code = data.code as ApiError["code"];
    }
  } catch { /* non-JSON error body */ }
  throw new ApiError(message, code);
}

/* ── Auth ───────────────────────────────────────────────────── */

export const authApi = {
  async requestOtp(phone: string): Promise<{ devCode?: string; expiresAt: number }> {
    return post("/api/auth/request-otp", { phone });
  },

  async verifyOtp(phone: string, code: string): Promise<User> {
    const res = await post<{ user: User }>("/api/auth/verify-otp", { phone, code });
    return res.user;
  },

  async me(): Promise<User | null> {
    try {
      const res = await get<{ user: User }>("/api/auth/me");
      return res.user;
    } catch (e) {
      if (e instanceof ApiError && e.code === "forbidden") return null;
      throw e;
    }
  },

  async logout(): Promise<void> {
    await post("/api/auth/logout", {}).catch(() => {});
  },

  /**
   * Avatar upload (multipart) / removal. Same error mapping as request()
   * but sends FormData — the server re-encodes the image, the returned
   * user carries the fresh avatarUrl.
   */
  async uploadAvatar(file: File): Promise<User> {
    assertOnline();
    const body = new FormData();
    body.set("file", file);
    let res: Response;
    try {
      res = await fetch("/api/me/avatar", { method: "POST", body, cache: "no-store" });
    } catch {
      throw new ApiError("ارتباط با سرور برقرار نشد.", "offline");
    }
    if (res.ok) return (await res.json()).user as User;
    let message = "آپلود آواتار ناموفق بود.";
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch { /* non-JSON error body */ }
    throw new ApiError(message);
  },

  async removeAvatar(): Promise<User> {
    const res = await del<{ user: User }>("/api/me/avatar");
    return res.user;
  },
};

/* ── Outside-hours classification (client hint; server is authoritative) ── */

export function computeOutsideKind(
  workDate: string,
  calendar: CalendarSettings,
  holidayDates: Iterable<string>,
): "normal" | "outside" | "weekend" | "holiday" {
  if (new Set(holidayDates).has(workDate)) return "holiday";
  const [y, m, d] = workDate.split("-").map(Number);
  const jw = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 1) % 7; // 0=شنبه
  if (!calendar.workingDays.includes(jw)) return "weekend";
  return "normal";
}

/* ── Collaborator ───────────────────────────────────────────── */

export interface CreateLogInput {
  workDate: string;
  description: string;
  durationMinutes: number;
}

export interface CollabDashboard {
  user: User;
  todayLogged: number;
  todayCount: number;
  weekLogged: number;
  monthLogged: number;
  approvedMinutes: number;
  pendingMinutes: number;
  pendingCount: number;
  rejectedMinutes: number;
  adjustedCount: number;
  outsideMinutes: number;
  recent: TimeLog[];
  lastLog: TimeLog | null;
}

export interface CollabStats {
  byDay: { date: string; minutes: number; approved: number }[];
  statusDist: { status: TimeLogStatus; minutes: number; count: number }[];
  outsideMinutes: number;
  totalMinutes: number;
  approvedMinutes: number;
  logCount: number;
}

export const collabApi = {
  async getMyLogs(_userId: string, f: LogsFilter = {}): Promise<TimeLog[]> {
    const q = new URLSearchParams();
    if (f.from) q.set("from", f.from);
    if (f.to) q.set("to", f.to);
    if (f.status) q.set("status", f.status);
    if (f.outsideOnly) q.set("outsideOnly", "1");
    const res = await get<{ items: TimeLog[] }>(`/api/logs?${q.toString()}`);
    return res.items;
  },

  async getLog(logId: string): Promise<{ log: TimeLog; user: User }> {
    return get(`/api/logs/${logId}`);
  },

  async createLog(_userId: string, input: CreateLogInput): Promise<TimeLog> {
    const res = await post<{ log: TimeLog }>("/api/logs", input);
    return res.log;
  },

  async updateLog(_userId: string, logId: string, input: Partial<CreateLogInput>): Promise<TimeLog> {
    const res = await put<{ log: TimeLog }>(`/api/logs/${logId}`, input);
    return res.log;
  },

  async deleteLog(_userId: string, logId: string): Promise<void> {
    await del(`/api/logs/${logId}`);
  },

  async getMyDashboard(_userId: string): Promise<CollabDashboard> {
    return get("/api/collab/dashboard");
  },

  async getMyStats(_userId: string, from: string, to: string): Promise<CollabStats> {
    return get(`/api/collab/stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  },
};

/* ── Admin ──────────────────────────────────────────────────── */

export interface AdminDashboardData {
  totalLogged: number;
  totalApproved: number;
  pendingMinutes: number;
  pendingCount: number;
  adjustedMinutes: number;
  adjustedCount: number;
  rejectedMinutes: number;
  outsideMinutes: number;
  peopleCount: number;
  activeToday: number;
  trend: { date: string; logged: number; approved: number }[];
  statusDist: { status: TimeLogStatus; minutes: number; count: number }[];
  peopleTop: { user: User; minutes: number }[];
  recentPending: TimeLog[];
}

export interface LogWithUser extends TimeLog {
  userName?: string;
}

export const adminApi = {
  async getDashboard(from?: string, to?: string): Promise<AdminDashboardData> {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return get(`/api/admin/dashboard?${q.toString()}`);
  },

  async getLogs(f: LogsFilter & { page?: number; pageSize?: number } = {}): Promise<{ items: TimeLog[]; total: number; page: number; hasMore: boolean }> {
    const q = new URLSearchParams();
    if (f.from) q.set("from", f.from);
    if (f.to) q.set("to", f.to);
    if (f.userId) q.set("userId", f.userId);
    if (f.status) q.set("status", f.status);
    if (f.outsideOnly) q.set("outsideOnly", "1");
    if (f.dayType && f.dayType !== "all") q.set("dayType", f.dayType);
    if (f.page) q.set("page", String(f.page));
    if (f.pageSize) q.set("pageSize", String(f.pageSize));
    return get(`/api/admin/logs?${q.toString()}`);
  },

  async approve(_adminId: string, logId: string): Promise<TimeLog> {
    const res = await post<{ log: TimeLog }>(`/api/admin/logs/${logId}/decision`, { action: "approve" });
    return res.log;
  },

  async adjust(_adminId: string, logId: string, minutes: number, note?: string): Promise<TimeLog> {
    const res = await post<{ log: TimeLog }>(`/api/admin/logs/${logId}/decision`, { action: "adjust", minutes, note });
    return res.log;
  },

  async reject(_adminId: string, logId: string, reason?: string): Promise<TimeLog> {
    const res = await post<{ log: TimeLog }>(`/api/admin/logs/${logId}/decision`, { action: "reject", reason });
    return res.log;
  },

  async getPeople(rangePreset: string, from?: string, to?: string, sort: "most" | "least" | "mostApproved" | "mostOutside" = "most"): Promise<UserSummary[]> {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    q.set("sort", sort);
    q.set("preset", rangePreset);
    return get(`/api/admin/people?${q.toString()}`);
  },

  async getPersonSummary(userId: string, from?: string, to?: string): Promise<{ summary: UserSummary; logs: TimeLog[]; byDay: { date: string; minutes: number; approved: number }[] }> {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return get(`/api/admin/people/${userId}/summary?${q.toString()}`);
  },

  async getOutsideHours(from?: string, to?: string): Promise<{ rows: { user: User; outsideMinutes: number; totalMinutes: number; logs: TimeLog[] }[]; total: number }> {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return get(`/api/admin/outside-hours?${q.toString()}`);
  },
};

/* ── Calendar / Holidays ────────────────────────────────────── */

export const calendarApi = {
  async get(): Promise<{ calendar: CalendarSettings; holidays: Holiday[] }> {
    return get("/api/settings/calendar");
  },

  async updateSettings(patch: Partial<CalendarSettings>): Promise<CalendarSettings> {
    const res = await put<{ calendar: CalendarSettings }>("/api/settings/calendar", patch);
    return res.calendar;
  },

  async addHoliday(date: string, title: string): Promise<Holiday> {
    const res = await post<{ holiday: Holiday }>("/api/settings/holidays", { date, title });
    return res.holiday;
  },

  async deleteHoliday(id: string): Promise<void> {
    await del(`/api/settings/holidays/${id}`);
  },
};

/* ── Printable reports (real: server-rendered HTML from live data) ── */

export const reportsApi = {
  /** Print-optimized HTML for the selected range/tab — opened via printHtml(). */
  async getPrintableReport(from: string, to: string, tab: "time" | "outside"): Promise<string> {
    const q = new URLSearchParams({ from, to, tab });
    return requestText(`/api/admin/report/export?${q.toString()}`);
  },
};

/* ── Users management (admin) ───────────────────────────────── */

export interface ManagedUser extends User {
  logCount: number;
}

export interface CreateUserInput {
  name: string;
  mobile: string;
  role: "admin" | "collaborator";
  avatarColor?: string;
}

export interface UpdateUserInput {
  name?: string;
  mobile?: string;
  role?: "admin" | "collaborator";
  isActive?: boolean;
  avatarColor?: string;
}

export const usersApi = {
  async getAll(): Promise<ManagedUser[]> {
    const res = await get<{ users: ManagedUser[] }>("/api/admin/users");
    return res.users;
  },

  async create(input: CreateUserInput): Promise<User> {
    const res = await post<{ user: User }>("/api/admin/users", input);
    return res.user;
  },

  async update(id: string, patch: UpdateUserInput): Promise<User> {
    const res = await put<{ user: User }>(`/api/admin/users/${id}`, patch);
    return res.user;
  },

  async remove(id: string): Promise<void> {
    await del(`/api/admin/users/${id}`);
  },
};

/* ── Offline drafts sync ────────────────────────────────────── */

let syncInFlight: Promise<{ synced: number; failed: number }> | null = null;

export const draftApi = {
  async saveDraft(draft: Omit<LogDraft, "id" | "createdAt">): Promise<LogDraft> {
    return offlineDrafts.add(draft);
  },
  async listDrafts(): Promise<LogDraft[]> {
    return offlineDrafts.list();
  },
  async removeDraft(id: string): Promise<void> {
    return offlineDrafts.remove(id);
  },
  /**
   * Singleton sync: multiple UI instances (chip, account, banner) may
   * trigger simultaneously — the lock guarantees a single pass so drafts
   * are never posted twice.
   */
  syncDrafts(userId: string, onProgress?: (done: number, total: number) => void): Promise<{ synced: number; failed: number }> {
    if (syncInFlight) return syncInFlight;
    const job = (async () => {
      const drafts = await offlineDrafts.list();
      let synced = 0;
      let failed = 0;
      for (let i = 0; i < drafts.length; i++) {
        const d = drafts[i];
        try {
          await collabApi.createLog(userId, { workDate: d.workDate, description: d.description, durationMinutes: d.durationMinutes });
          await offlineDrafts.remove(d.id);
          synced++;
        } catch {
          failed++;
        }
        onProgress?.(i + 1, drafts.length);
      }
      return { synced, failed };
    })();
    syncInFlight = job;
    void job.finally(() => {
      if (syncInFlight === job) syncInFlight = null;
    });
    return job;
  },
};
