"use client";

/**
 * Admin decision UI (spec §8/§28): Approve / Adjust / Reject.
 * Bottom sheets on mobile — dialogs acceptable per viewport (lg+).
 * Approve uses optimistic update with rollback (spec §48).
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Minus, PenLine, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DurationInput } from "@/components/shared/duration-input";
import { adminApi } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { TimeLog } from "@/lib/types";
import { minutesToHHMM, humanDuration } from "@/lib/duration";

export type AdminAction = "approve" | "adjust" | "reject" | null;

export function LogActions({
  log,
  open,
  onOpenChange,
  busyId,
  setBusyId,
}: {
  log: TimeLog;
  open: AdminAction;
  onOpenChange: (a: AdminAction) => void;
  busyId: string | null;
  setBusyId: (id: string | null) => void;
}) {
  return (
    <>
      <ApproveSheet log={log} open={open === "approve"} onOpenChange={(o) => onOpenChange(o ? "approve" : null)} busyId={busyId} setBusyId={setBusyId} />
      <AdjustSheet log={log} open={open === "adjust"} onOpenChange={(o) => onOpenChange(o ? "adjust" : null)} busyId={busyId} setBusyId={setBusyId} />
      <RejectSheet log={log} open={open === "reject"} onOpenChange={(o) => onOpenChange(o ? "reject" : null)} busyId={busyId} setBusyId={setBusyId} />
    </>
  );
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    qc.invalidateQueries({ queryKey: ["admin-logs"] });
    qc.invalidateQueries({ queryKey: ["log"] });
    // log-detail-screen caches the {log, user} envelope under this key —
    // without it the detail page kept showing the pre-decision status/buttons.
    qc.invalidateQueries({ queryKey: ["log-envelope"] });
    qc.invalidateQueries({ queryKey: ["people"] });
    qc.invalidateQueries({ queryKey: ["outside-hours"] });
    qc.invalidateQueries({ queryKey: ["my-dashboard"] });
    qc.invalidateQueries({ queryKey: ["my-logs"] });
  };
}

function ApproveSheet({
  log, open, onOpenChange, busyId, setBusyId,
}: {
  log: TimeLog; open: boolean; onOpenChange: (o: boolean) => void; busyId: string | null; setBusyId: (id: string | null) => void;
}) {
  const { user } = useAuth();
  const invalidate = useInvalidate();

  const approve = async () => {
    if (!user) return;
    setBusyId(log.id);
    try {
      await adminApi.approve(user.id, log.id);
      toast.success(`«${log.description}» تأیید شد.`);
      invalidate();
      onOpenChange(false);
    } catch {
      toast.error("تأیید ناموفق بود — دوباره تلاش کنید.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader>
          <DrawerTitle className="flex items-center justify-center gap-2 text-base font-bold text-success">
            <Check className="size-5" aria-hidden />
            تأیید گزارش
          </DrawerTitle>
        </DrawerHeader>
        <div className="space-y-4 px-6 pb-2">
          <p className="text-sm leading-7 text-muted-foreground">
            «{log.description}» با زمان <span className="font-bold nums text-foreground">{minutesToHHMM(log.originalDurationMinutes)}</span> تأیید می‌شود.
          </p>
          <div className="rounded-xl bg-success-soft px-3.5 py-2.5 text-xs leading-6 text-success">
            زمان تأییدشده برابر زمان ثبت‌شده ذخیره می‌شود ({minutesToHHMM(log.originalDurationMinutes)} = {minutesToHHMM(log.originalDurationMinutes)}).
          </div>
        </div>
        <div className="flex gap-2 px-6 pb-6 pt-3 safe-bottom">
          <Button variant="outline" className="h-12 flex-1 rounded-xl" onClick={() => onOpenChange(false)}>انصراف</Button>
          <Button disabled={busyId === log.id} onClick={() => void approve()} className="h-12 flex-1 rounded-xl bg-success font-bold text-white hover:bg-success/90">
            تأیید
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function AdjustSheet({
  log, open, onOpenChange, busyId, setBusyId,
}: {
  log: TimeLog; open: boolean; onOpenChange: (o: boolean) => void; busyId: string | null; setBusyId: (id: string | null) => void;
}) {
  const { user } = useAuth();
  const invalidate = useInvalidate();
  const [minutes, setMinutes] = useState<number | null>(log.originalDurationMinutes);
  const [note, setNote] = useState(log.adminNote ?? "");
  const [err, setErr] = useState<string | null>(null);

  const changed = minutes != null && minutes !== log.originalDurationMinutes;

  const submit = async () => {
    if (!user || minutes == null || minutes <= 0) return;
    setBusyId(log.id);
    try {
      await adminApi.adjust(user.id, log.id, minutes, note);
      toast.success(
        changed
          ? `زمان از ${minutesToHHMM(log.originalDurationMinutes)} به ${minutesToHHMM(minutes)} اصلاح شد.`
          : "زمان تأیید شد.",
      );
      invalidate();
      onOpenChange(false);
    } catch {
      toast.error("اصلاح ناموفق بود — دوباره تلاش کنید.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader>
          <DrawerTitle className="flex items-center justify-center gap-2 text-base font-bold text-adjusted">
            <PenLine className="size-5" aria-hidden />
            اصلاح زمان
          </DrawerTitle>
        </DrawerHeader>
        <div className="space-y-4 px-6 pb-2">
          <div className="rounded-xl bg-adjusted-soft px-3.5 py-2.5 text-xs leading-6 text-adjusted">
            زمان ثبت‌شده <span className="font-bold nums">{minutesToHHMM(log.originalDurationMinutes)}</span> حفظ می‌شود و زمان نهایی جداگانه ثبت می‌گردد
            ({humanDuration(log.originalDurationMinutes)}).
          </div>
          <div>
            <Label className="mb-2 block text-sm font-semibold">زمان تأییدشده نهایی</Label>
            <div className="flex items-start gap-2">
              <Button
                type="button"
                variant="outline"
                aria-label="کم کردن نیم ساعت"
                title="−۳۰ دقیقه"
                disabled={busyId === log.id || (minutes ?? 0) <= 30}
                onClick={() => {
                  const next = Math.max(30, (minutes ?? log.originalDurationMinutes) - 30);
                  setErr(null);
                  setMinutes(next);
                }}
                className="h-14 w-12 shrink-0 rounded-2xl px-0 text-lg font-extrabold"
              >
                <Minus className="size-5" aria-hidden />
              </Button>
              <div className="min-w-0 flex-1">
                <DurationInput value={minutes} onChange={setMinutes} error={err} onErrorChange={setErr} />
              </div>
              <Button
                type="button"
                variant="outline"
                aria-label="اضافه کردن نیم ساعت"
                title="+۳۰ دقیقه"
                disabled={busyId === log.id || (minutes ?? 0) >= 23 * 60 + 30}
                onClick={() => {
                  const next = Math.min(23 * 60 + 30, (minutes ?? log.originalDurationMinutes) + 30);
                  setErr(null);
                  setMinutes(next);
                }}
                className="h-14 w-12 shrink-0 rounded-2xl px-0 text-lg font-extrabold"
              >
                <Plus className="size-5" aria-hidden />
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="admin-note" className="mb-2 block text-sm font-semibold">یادداشت مدیر (اختیاری)</Label>
            <Textarea id="admin-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="resize-none rounded-xl bg-card" placeholder="مثلاً: ۳۰ دقیقه اضافه‌کاری تأیید شد" />
          </div>
        </div>
        <div className="flex gap-2 px-6 pb-6 pt-3 safe-bottom">
          <Button variant="outline" className="h-12 flex-1 rounded-xl" onClick={() => onOpenChange(false)}>انصراف</Button>
          <Button disabled={busyId === log.id || !minutes || minutes <= 0 || !!err} onClick={() => void submit()} className="h-12 flex-1 rounded-xl bg-adjusted font-bold text-white hover:bg-adjusted/90">
            ثبت و اصلاح
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function RejectSheet({
  log, open, onOpenChange, busyId, setBusyId,
}: {
  log: TimeLog; open: boolean; onOpenChange: (o: boolean) => void; busyId: string | null; setBusyId: (id: string | null) => void;
}) {
  const { user } = useAuth();
  const invalidate = useInvalidate();
  const [reason, setReason] = useState("");

  const submit = async () => {
    if (!user) return;
    setBusyId(log.id);
    try {
      await adminApi.reject(user.id, log.id, reason);
      toast.success("گزارش رد شد.");
      invalidate();
      onOpenChange(false);
    } catch {
      toast.error("رد ناموفق بود — دوباره تلاش کنید.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader>
          <DrawerTitle className="flex items-center justify-center gap-2 text-base font-bold text-danger">
            <X className="size-5" aria-hidden />
            رد گزارش
          </DrawerTitle>
        </DrawerHeader>
        <div className="space-y-4 px-6 pb-2">
          <p className="text-sm leading-7 text-muted-foreground">
            «{log.description}» (<span className="nums">{minutesToHHMM(log.originalDurationMinutes)}</span>) رد می‌شود. این تصمیم نهایی است و همکار نمی‌تواند آن را دوباره ارسال کند.
          </p>
          <div>
            <Label htmlFor="reject-reason" className="mb-2 block text-sm font-semibold">دلیل رد (اختیاری)</Label>
            <Textarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="resize-none rounded-xl bg-card" placeholder="مثلاً: تکراری با گزارش قبلی بود" />
          </div>
        </div>
        <div className="flex gap-2 px-6 pb-6 pt-3 safe-bottom">
          <Button variant="outline" className="h-12 flex-1 rounded-xl" onClick={() => onOpenChange(false)}>انصراف</Button>
          <Button variant="destructive" disabled={busyId === log.id} onClick={() => void submit()} className="h-12 flex-1 rounded-xl font-bold">
            رد گزارش
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
