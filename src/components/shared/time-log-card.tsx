"use client";

/**
 * TimeLogCard (spec §25) — mobile-first log item.
 * Adjusted logs show "02:30 → 03:00" transition clearly (spec §25).
 * Admin quick actions support in-list approve/reject (spec §28).
 */

import { Check, Pencil, X } from "lucide-react";
import { TimeLog, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/format";
import { minutesToHHMM } from "@/lib/duration";
import { relativeDayLabel, formatJalali } from "@/lib/jalali";
import { StatusBadge, OutsideBadge, STATUS_META } from "./status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.map((p) => p[0]).slice(0, 2).join("");
}

/** Uploaded avatar image with initials fallback — shared across screens. */
export function UserAvatar({ user, className }: { user: User; className?: string }) {
  return (
    <Avatar className={className}>
      {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
      <AvatarFallback
        className="text-[10px] font-bold text-white"
        style={{ backgroundColor: user.avatarColor }}
      >
        {initials(user.name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function UserChip({ user, size = "sm" }: { user: User; size?: "sm" | "md" }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <UserAvatar user={user} className={size === "sm" ? "size-6" : "size-9"} />
      <span className={cn("truncate font-medium", size === "sm" ? "text-xs" : "text-sm")}>{user.name}</span>
    </span>
  );
}

export function TimeLogCard({
  log,
  user,
  showUser = false,
  onOpen,
  onApprove,
  onReject,
  onEdit,
  busy,
}: {
  log: TimeLog;
  user?: User;
  showUser?: boolean;
  onOpen?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
  busy?: boolean;
}) {
  const meta = STATUS_META[log.status];
  const adjusted = log.status === "adjusted" && log.approvedDurationMinutes != null;
  const rejected = log.status === "rejected";

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card app-shadow transition-colors",
        onOpen && "cursor-pointer hover:border-primary/35 active:bg-accent/30",
      )}
      onClick={onOpen}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === "Enter") onOpen(); } : undefined}
      aria-label={`گزارش: ${log.description}`}
    >
      <span className={cn("absolute inset-y-0 right-0 w-1", meta.dot)} aria-hidden />

      <div className="p-3.5 pr-4.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-7">{log.description}</h3>
          <div className="shrink-0 text-left">
            {adjusted ? (
              <div className="flex items-center gap-1.5 font-bold nums" dir="ltr">
                <span className="text-sm text-muted-foreground line-through decoration-danger/70">
                  {minutesToHHMM(log.originalDurationMinutes)}
                </span>
                <span className="text-muted-foreground">←</span>
                <span className="text-adjusted">{minutesToHHMM(log.approvedDurationMinutes!)}</span>
              </div>
            ) : (
              <div className={cn("text-base font-bold nums", rejected && "text-muted-foreground line-through decoration-danger/60")}>
                {minutesToHHMM(log.originalDurationMinutes)}
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          {showUser && user ? <UserChip user={user} /> : null}
          <span className="nums">{relativeDayLabel(log.workDate)}</span>
          <span className="opacity-40">•</span>
          <span className="nums">{formatJalali(log.workDate, "short")}</span>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={log.status} size="xs" />
          <OutsideBadge kind={log.outsideKind} size="xs" />
          {log.status === "pending" && onApprove ? (
            <span className="ms-auto flex items-center gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={(e) => { e.stopPropagation(); onApprove(); }}
                aria-label="تأیید سریع"
                title="تأیید"
                className="flex size-9 items-center justify-center rounded-xl bg-success-soft text-success transition-all hover:bg-success hover:text-white active:scale-90 disabled:opacity-50"
              >
                <Check className="size-4.5" aria-hidden />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={(e) => { e.stopPropagation(); onReject?.(); }}
                aria-label="رد سریع"
                title="رد"
                className="flex size-9 items-center justify-center rounded-xl bg-danger-soft text-danger transition-all hover:bg-danger hover:text-white active:scale-90 disabled:opacity-50"
              >
                <X className="size-4.5" aria-hidden />
              </button>
            </span>
          ) : null}
          {log.status === "pending" && onEdit ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              aria-label="ویرایش"
              className="ms-auto flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground active:scale-90"
            >
              <Pencil className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>

        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
            <span className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function LogsGroupHeader({ date, totalMinutes, count }: { date: string; totalMinutes: number; count: number }) {
  return (
    <div className="sticky top-[68px] z-20 -mx-1 flex items-center justify-between bg-background/85 px-1 py-2 backdrop-blur-sm">
      <span className="text-sm font-bold">{relativeDayLabel(date)}</span>
      <span className="text-xs text-muted-foreground nums">
        {toPersianDigits(count)} گزارش • {minutesToHHMM(totalMinutes)}
      </span>
    </div>
  );
}
