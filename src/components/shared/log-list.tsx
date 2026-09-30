"use client";

/**
 * Shared virtualized log list — built for large datasets.
 *
 * CompactLogRow: a ~52px dense row (was a ~110px card) so 100+ logs fit in
 * a couple of screens. Adjusted durations show "02:30 ← 03:00" inline.
 * VirtualLogList: window-scroll virtualization (@tanstack/react-virtual) with
 * dynamic row measurement and Jalali day-group headers — rendering cost stays
 * constant (~overscan rows) regardless of how many logs are loaded.
 * Rows are React.memo'd so quick-action state changes don't re-render the list.
 */

import { memo, useEffect, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Check, Clock3, Pencil, X } from "lucide-react";
import { TimeLog, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/format";
import { minutesToHHMM } from "@/lib/duration";
import { relativeDayLabel } from "@/lib/jalali";
import { StatusBadge, OutsideBadge, STATUS_META } from "./status-badge";
import { UserAvatar } from "./time-log-card";

/* ── Compact row ────────────────────────────────────────────────────────── */

function CompactLogRowImpl({
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
  const pending = log.status === "pending";

  const duration = (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap text-[13px] font-bold nums tabular-nums",
        rejected && "text-muted-foreground line-through decoration-danger/60",
      )}
      dir="ltr"
    >
      {adjusted ? (
        <>
          <span className="text-[11px] font-semibold text-muted-foreground line-through decoration-danger/70">
            {minutesToHHMM(log.originalDurationMinutes)}
          </span>
          <span className="mx-0.5 text-[10px] text-muted-foreground">←</span>
          <span className="text-adjusted">{minutesToHHMM(log.approvedDurationMinutes!)}</span>
        </>
      ) : (
        minutesToHHMM(log.originalDurationMinutes)
      )}
    </span>
  );

  return (
    <article
      className={cn(
        "relative flex min-h-[52px] items-center gap-2 overflow-hidden rounded-xl border bg-card transition-colors",
        onOpen && "cursor-pointer hover:border-primary/35 active:bg-accent/30",
        busy && "pointer-events-none opacity-60",
      )}
      onClick={onOpen}
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === "Enter") onOpen(); } : undefined}
      aria-label={`گزارش: ${log.description}`}
    >
      <span className={cn("absolute inset-y-1 right-0 w-[3px] rounded-full", meta.dot)} aria-hidden />

      <div className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pe-2 ps-3.5">
        {showUser && user ? (
          <UserAvatar user={user} className="size-5 shrink-0 [&_[data-slot=avatar-fallback]]:text-[8px]" />
        ) : null}

        <span className="hidden shrink-0 text-[11px] text-muted-foreground nums min-[420px]:block" title={relativeDayLabel(log.workDate)}>
          {relativeDayLabel(log.workDate)}
        </span>

        <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-6" title={log.description}>
          {log.description}
        </span>

        {duration}
        <StatusBadge status={log.status} size="xs" />
        <OutsideBadge kind={log.outsideKind} size="xs" />

        {pending && (onApprove || onEdit) ? (
          <span className="flex shrink-0 items-center gap-1">
            {onApprove ? (
              <button
                type="button"
                disabled={busy}
                onClick={(e) => { e.stopPropagation(); onApprove(); }}
                aria-label="تأیید سریع"
                title="تأیید"
                className="flex size-7 items-center justify-center rounded-lg bg-success-soft text-success transition-all hover:bg-success hover:text-white active:scale-90 disabled:opacity-50"
              >
                <Check className="size-3.5" aria-hidden />
              </button>
            ) : null}
            {onReject ? (
              <button
                type="button"
                disabled={busy}
                onClick={(e) => { e.stopPropagation(); onReject(); }}
                aria-label="رد سریع"
                title="رد"
                className="flex size-7 items-center justify-center rounded-lg bg-danger-soft text-danger transition-all hover:bg-danger hover:text-white active:scale-90 disabled:opacity-50"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
            {onEdit ? (
              <button
                type="button"
                disabled={busy}
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                aria-label="ویرایش"
                title="ویرایش"
                className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors hover:bg-accent active:scale-90 disabled:opacity-50"
              >
                <Pencil className="size-3" aria-hidden />
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
    </article>
  );
}

export const CompactLogRow = memo(CompactLogRowImpl);

/* ── Virtualized list ───────────────────────────────────────────────────── */

export type VirtualItem =
  | { kind: "header"; key: string; date: string; totalMinutes: number; count: number }
  | {
      kind: "log";
      key: string;
      log: TimeLog;
      user?: User;
      showUser?: boolean;
      onOpen?: () => void;
      onApprove?: () => void;
      onReject?: () => void;
      onEdit?: () => void;
      busy?: boolean;
    };

function GroupHeaderImpl({ date, totalMinutes, count }: { date: string; totalMinutes: number; count: number }) {
  return (
    <div className="flex items-center justify-between border-b bg-background/95 px-1 py-1.5" aria-hidden={false}>
      <span className="flex items-center gap-1.5 text-xs font-bold">
        <Clock3 className="size-3.5 text-primary" aria-hidden />
        {relativeDayLabel(date)}
      </span>
      <span className="text-[11px] text-muted-foreground nums">
        {toPersianDigits(count)} گزارش • {minutesToHHMM(totalMinutes)}
      </span>
    </div>
  );
}
const GroupHeader = memo(GroupHeaderImpl);

type LogRowProps = Omit<Extract<VirtualItem, { kind: "log" }>, "kind" | "key">;

const LogRowCard = memo(function LogRowCard({ log, user, showUser, onOpen, onApprove, onReject, onEdit, busy }: LogRowProps) {
  return <CompactLogRow log={log} user={user} showUser={showUser} onOpen={onOpen} onApprove={onApprove} onReject={onReject} onEdit={onEdit} busy={busy} />;
});

/**
 * Window-scroll virtualized list. Flat lists (admin) pass items without
 * headers; grouped lists (my logs) pass header items — all measured
 * dynamically. `estimateSize` is a fast initial guess, real heights are
 * measured per row.
 */
export function VirtualLogList({
  items,
  estimateSize = 56,
  overscan = 8,
  ariaLabel,
}: {
  items: VirtualItem[];
  estimateSize?: number;
  overscan?: number;
  ariaLabel?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useEffect(() => {
    // Distance from document top so item offsets map onto window coordinates.
    // MUST stay fresh: anything above the list (headers, filters, content
    // loading) shifts the list — stale margins misplace rows and clicks land
    // on the wrong item. Re-measure on body size changes + list identity.
    let raf = 0;
    const update = () => {
      const el = listRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      setScrollMargin((m) => (Math.abs(m - top) > 1 ? top : m));
    };
    update();
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    if (listRef.current?.parentElement) ro.observe(listRef.current.parentElement);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [items]);

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => estimateSize,
    overscan,
    scrollMargin,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  return (
    <div
      ref={listRef}
      className="relative w-full"
      style={{ height: virtualizer.getTotalSize() }}
      role="list"
      aria-label={ariaLabel}
    >
      {virtualizer.getVirtualItems().map((vi) => {
        const item = items[vi.index];
        return (
          <div
            key={item.key}
            data-index={vi.index}
            ref={virtualizer.measureElement}
            className="absolute inset-x-0 top-0 animate-in fade-in slide-in-from-bottom-1 duration-200 pb-2"
            style={{ transform: `translateY(${vi.start - scrollMargin}px)` }}
            role="listitem"
          >
            {item.kind === "header" ? (
              <GroupHeader date={item.date} totalMinutes={item.totalMinutes} count={item.count} />
            ) : (
              <LogRowCard
                log={item.log}
                user={item.user}
                showUser={item.showUser}
                onOpen={item.onOpen}
                onApprove={item.onApprove}
                onReject={item.onReject}
                onEdit={item.onEdit}
                busy={item.busy}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Flatten Jalali day-groups into virtual items (headers + rows). */
export function buildGroupedVirtualItems(
  groups: { date: string; logs: TimeLog[]; total: number }[],
  perLog: (log: TimeLog) => Extract<VirtualItem, { kind: "log" }>,
): VirtualItem[] {
  const out: VirtualItem[] = [];
  for (const g of groups) {
    out.push({ kind: "header", key: `h-${g.date}`, date: g.date, totalMinutes: g.total, count: g.logs.length });
    for (const log of g.logs) out.push(perLog(log));
  }
  return out;
}
