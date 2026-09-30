/** Domain types — mirrors spec §6/§57/§58 field contracts. */

export type Role = "admin" | "collaborator";

export type TimeLogStatus = "pending" | "approved" | "adjusted" | "rejected";

export type OutsideHoursKind =
  | "normal"
  | "outside"
  | "holiday"
  | "weekend";

export interface User {
  id: string;
  name: string;
  mobile: string;
  role: Role;
  isActive: boolean;
  avatarColor: string;
  /** Web path of the uploaded avatar; null → initials avatar */
  avatarUrl: string | null;
}

export interface TimeLog {
  id: string;
  userId: string;
  /** ISO date (gregorian, local midnight) — display layer converts to Jalali */
  workDate: string; // yyyy-mm-dd
  description: string;
  originalDurationMinutes: number;
  approvedDurationMinutes: number | null;
  status: TimeLogStatus;
  outsideKind: OutsideHoursKind;
  adminNote: string | null;
  rejectionReason: string | null;
  approvedBy: string | null;
  approvedByName?: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Holiday {
  id: string;
  /** ISO date */
  date: string;
  title: string;
}

export interface CalendarSettings {
  /** 0=شنبه … 6=جمعه (Jalali week order) */
  workingDays: number[];
  workingStartTime: string; // "08:00"
  workingEndTime: string; // "17:00"
}

export interface LogDraft {
  id: string;
  workDate: string;
  description: string;
  durationMinutes: number;
  createdAt: string;
}

export interface LogsFilter {
  from?: string;
  to?: string;
  userId?: string | null;
  status?: TimeLogStatus | null;
  outsideOnly?: boolean;
  dayType?: "all" | "workday" | "holiday" | "weekend";
}

export interface UserSummary {
  user: User;
  totalLoggedMinutes: number;
  totalApprovedMinutes: number;
  pendingMinutes: number;
  adjustedCount: number;
  rejectedMinutes: number;
  outsideMinutes: number;
  logCount: number;
}

export type RangePreset =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "custom";
