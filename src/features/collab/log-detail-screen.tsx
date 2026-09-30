"use client";

/**
 * Log Detail (spec §76.9/§76.15) — full log info for both roles.
 * Collaborator: edit/delete pending. Admin: Approve/Adjust/Reject actions.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Eye, FileText, PenLine, ShieldAlert, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge, OutsideBadge } from "@/components/shared/status-badge";
import { PageSpinner, ErrorState } from "@/components/shared/states";
import { UserChip } from "@/components/shared/time-log-card";
import { LogActions, AdminAction } from "@/components/shared/log-actions";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { collabApi } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "@/navigation/router";
import { formatJalali } from "@/lib/jalali";
import { minutesToHHMM } from "@/lib/duration";
import { toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="shrink-0 text-[13px] text-muted-foreground">{label}</span>
      <span className="text-left text-[13px] font-semibold">{children}</span>
    </div>
  );
}

export function LogDetailScreen({ logId }: { logId: string }) {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [action, setAction] = useState<AdminAction>(null);
  const [busy, setBusy] = useState(false);

  const isAdmin = user?.role === "admin";

  const { data: res, isLoading, isError } = useQuery({
    // NOTE: distinct key — the log FORM caches the bare TimeLog under
    // ["log", id]; this screen caches the {log, user} envelope. Sharing a key
    // would feed the envelope into the edit form and crash it.
    queryKey: ["log-envelope", logId],
    queryFn: () => collabApi.getLog(logId), // owner/admin/team-manager enforced server-side
    enabled: !!user,
  });

  const log = res?.log ?? null;
  const logUser = res?.user ?? null;
  // Decisions belong to the log owner's team manager only
  const canDecide = user?.role === "manager" && logUser?.managerId === user?.id;

  if (isLoading) return <PageSpinner />;
  if (isError || !log) return <ErrorState onRetry={() => navigate("/logs")} title="این گزارش پیدا نشد." description="ممکن است حذف شده باشد یا دسترسی نداشته باشید." />;

  const canEdit = !isAdmin && log.status === "pending";

  return (
    <div>
      <PageHeader title="جزئیات گزارش" back />

      <div className="space-y-4">
        {/* Main card */}
        <section className="rounded-2xl border bg-card p-5 app-shadow">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-extrabold leading-8">{log.description}</h2>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={log.status} />
            <OutsideBadge kind={log.outsideKind} />
          </div>

          {/* Duration — original vs approved */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-muted/70 p-3.5 text-center">
              <p className="text-[11px] text-muted-foreground">ثبت‌شده توسط همکار</p>
              <p className={cn("mt-1 text-2xl font-extrabold nums", log.status === "rejected" && "text-muted-foreground line-through")}>
                {minutesToHHMM(log.originalDurationMinutes)}
              </p>
            </div>
            <div className="rounded-2xl bg-success-soft p-3.5 text-center">
              <p className="text-[11px] text-success">زمان نهایی تأییدشده</p>
              <p className="mt-1 text-2xl font-extrabold nums text-success">
                {log.approvedDurationMinutes != null ? minutesToHHMM(log.approvedDurationMinutes) : "—"}
              </p>
            </div>
          </div>

          {log.status === "adjusted" && log.approvedDurationMinutes != null ? (
            <p className="mt-2.5 text-center text-xs font-semibold text-adjusted nums">
              {minutesToHHMM(log.originalDurationMinutes)} → {minutesToHHMM(log.approvedDurationMinutes)}
              {log.approvedDurationMinutes > log.originalDurationMinutes ? " (افزایش)" : " (کاهش)"}
            </p>
          ) : null}
        </section>

        {/* Admin note / rejection reason */}
        {log.adminNote ? (
          <section className="flex items-start gap-2.5 rounded-2xl border border-adjusted/40 bg-adjusted-soft p-4">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-adjusted" aria-hidden />
            <div>
              <p className="text-xs font-bold text-adjusted">یادداشت مدیر</p>
              <p className="mt-1 text-sm leading-7 text-adjusted/90">{log.adminNote}</p>
            </div>
          </section>
        ) : null}
        {log.rejectionReason ? (
          <section className="flex items-start gap-2.5 rounded-2xl border border-danger/40 bg-danger-soft p-4">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
            <div>
              <p className="text-xs font-bold text-danger">دلیل رد</p>
              <p className="mt-1 text-sm leading-7 text-danger/90">{log.rejectionReason}</p>
            </div>
          </section>
        ) : null}

        {/* Meta */}
        <section className="rounded-2xl border bg-card px-5 py-2 app-shadow">
          <Row label="کاربر">
            {logUser ? <UserChip user={logUser} /> : "—"}
          </Row>
          <Separator />
          <Row label="تاریخ کار"><span className="nums">{formatJalali(log.workDate, "full")}</span></Row>
          <Separator />
          <Row label="زمان ثبت">
            <span className="nums">{toPersianDigits(new Date(log.createdAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }))}</span>
          </Row>
          {log.approvedAt ? (
            <>
              <Separator />
              <Row label="تصمیم مدیر">
                <span className="nums">{formatJalali(log.approvedAt.slice(0, 10), "full")}</span>
              </Row>
            </>
          ) : null}
          {log.approvedByName ? (
            <>
              <Separator />
              <Row label="تأییدکننده">{log.approvedByName}</Row>
            </>
          ) : null}
        </section>

        {/* Actions */}
        <div className="flex flex-wrap gap-2.5 pb-4">
          {canEdit ? (
            <>
              <Button onClick={() => navigate(`/logs/${log.id}/edit`)} className="h-12 flex-1 rounded-xl font-bold">
                <PenLine className="size-4.5" aria-hidden />
                ویرایش گزارش
              </Button>
            </>
          ) : null}
          {canDecide && log.status === "pending" ? (
            <>
              <Button onClick={() => setAction("approve")} disabled={busy} className="h-12 flex-1 rounded-xl bg-success font-bold text-white hover:bg-success/90">
                <Check className="size-4.5" aria-hidden />
                تأیید
              </Button>
              <Button onClick={() => setAction("adjust")} disabled={busy} className="h-12 flex-1 rounded-xl bg-adjusted font-bold text-white hover:bg-adjusted/90">
                <PenLine className="size-4.5" aria-hidden />
                اصلاح زمان
              </Button>
              <Button variant="destructive" onClick={() => setAction("reject")} disabled={busy} className="h-12 flex-1 rounded-xl font-bold">
                <X className="size-4.5" aria-hidden />
                رد
              </Button>
            </>
          ) : null}
          {isAdmin && log.status === "pending" ? (
            <div className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent/60 py-3.5 text-xs font-semibold text-accent-foreground">
              <Eye className="size-4" aria-hidden />
              مدیر ارشد فقط مشاهده‌گر است — تصمیم‌گیری با مدیر تیم است.
            </div>
          ) : null}
          {!canEdit && !(canDecide && log.status === "pending") && !isAdmin ? (
            <div className="flex w-full items-center justify-center gap-2 rounded-2xl bg-muted/60 py-3.5 text-xs text-muted-foreground">
              <FileText className="size-4" aria-hidden />
              این گزارش قفل شده — پس از تصمیم مدیر قابل تغییر نیست.
            </div>
          ) : null}
        </div>
      </div>

      {canDecide ? (
        <LogActions log={log} open={action} onOpenChange={setAction} busyId={busy ? log.id : null} setBusyId={(id) => setBusy(!!id)} />
      ) : null}
    </div>
  );
}
