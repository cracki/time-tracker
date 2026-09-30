"use client";

/**
 * Holidays (spec §12) — annual holiday list + add/delete, Jalali year filter.
 */

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { PersianDatePicker } from "@/components/shared/persian-date-picker";
import { LogListSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { calendarApi } from "@/lib/api";
import { dateToJalali, formatJalali, parseIso, today } from "@/lib/jalali";
import { toPersianDigits } from "@/lib/format";

export function HolidaysScreen() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["calendar"],
    queryFn: () => calendarApi.get(),
  });

  const currentJy = dateToJalali(today()).jy;
  const [year, setYear] = useState(currentJy);
  const [addOpen, setAddOpen] = useState(false);
  const [newDate, setNewDate] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const holidays = useMemo(
    () => (data ? data.holidays.filter((h) => dateToJalali(parseIso(h.date)).jy === year) : []),
    [data, year],
  );

  const add = async () => {
    if (!newDate || !newTitle.trim()) {
      toast.error("تاریخ و عنوان تعطیلی الزامی است.");
      return;
    }
    setSaving(true);
    try {
      await calendarApi.addHoliday(newDate, newTitle);
      toast.success("تعطیلی اضافه شد.");
      void qc.invalidateQueries({ queryKey: ["calendar"] });
      setAddOpen(false);
      setNewDate(null);
      setNewTitle("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "افزودن ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await calendarApi.deleteHoliday(id);
      toast.success("تعطیلی حذف شد.");
      void qc.invalidateQueries({ queryKey: ["calendar"] });
    } catch {
      toast.error("حذف ناموفق بود.");
    }
  };

  return (
    <div>
      <PageHeader
        title="تعطیلات رسمی"
        subtitle={`سال ${toPersianDigits(year)}`}
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)} className="h-10 gap-1.5 rounded-xl px-3 text-xs font-bold">
            <Plus className="size-4" aria-hidden />
            افزودن
          </Button>
        }
      />

      {/* Year switcher */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setYear((y) => y - 1)}
          className="min-h-10 rounded-xl border bg-card px-4 text-sm font-bold nums"
          aria-label="سال قبل"
        >
          {toPersianDigits(year - 1)}
        </button>
        <span className="flex-1 text-center text-sm font-bold nums">{toPersianDigits(year)}</span>
        <button
          onClick={() => setYear((y) => y + 1)}
          className="min-h-10 rounded-xl border bg-card px-4 text-sm font-bold nums"
          aria-label="سال بعد"
        >
          {toPersianDigits(year + 1)}
        </button>
      </div>

      {isLoading ? (
        <LogListSkeleton count={4} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : holidays.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={`تعطیلی برای سال ${toPersianDigits(year)} ثبت نشده است.`}
          description="تعطیلات رسمی سالانه را از دکمه «افزودن» وارد کنید."
        />
      ) : (
        <div className="space-y-2 pb-6">
          {holidays
            .sort((a, b) => (a.date < b.date ? -1 : 1))
            .map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 app-shadow">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-danger-soft text-danger">
                    <span className="text-sm font-extrabold leading-4 nums">{toPersianDigits(dateToJalali(parseIso(h.date)).jd)}</span>
                    <span className="text-[9px] font-semibold">{jMonthShort(dateToJalali(parseIso(h.date)).jm)}</span>
                  </span>
                  <div>
                    <p className="text-sm font-bold">{h.title}</p>
                    <p className="text-[11px] text-muted-foreground nums">{formatJalali(h.date, "full")}</p>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      aria-label={`حذف ${h.title}`}
                      className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent dir="rtl" className="max-w-sm rounded-3xl">
                    <AlertDialogHeader className="text-right">
                      <AlertDialogTitle>حذف این تعطیلی؟</AlertDialogTitle>
                      <AlertDialogDescription>{h.title} — {formatJalali(h.date, "full")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row justify-start gap-2">
                      <AlertDialogAction onClick={() => void remove(h.id)} className="bg-danger text-white hover:bg-danger/90">حذف</AlertDialogAction>
                      <AlertDialogCancel>انصراف</AlertDialogCancel>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
        </div>
      )}

      {/* Add drawer */}
      <Drawer open={addOpen} onOpenChange={setAddOpen}>
        <DrawerContent className="mx-auto max-w-md">
          <DrawerHeader>
            <DrawerTitle className="text-center text-base font-bold">افزودن تعطیلی</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4 px-6 pb-2">
            <div>
              <Label className="mb-2 block text-sm font-semibold">تاریخ</Label>
              <PersianDatePicker
                value={newDate}
                onChange={setNewDate}
                allowFuture
                placeholder="انتخاب تاریخ تعطیلی"
              />
            </div>
            <div>
              <Label htmlFor="h-title" className="mb-2 block text-sm font-semibold">عنوان</Label>
              <Input
                id="h-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="مثلاً: نوروز"
                className="h-12 rounded-xl bg-card"
              />
            </div>
          </div>
          <div className="px-6 pb-6 pt-3 safe-bottom">
            <Button onClick={() => void add()} disabled={saving || !newDate || !newTitle.trim()} className="h-12 w-full rounded-xl font-bold">
              {saving ? "در حال ذخیره…" : "افزودن تعطیلی"}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function jMonthShort(m: number): string {
  return ["فرور", "ارد", "خرد", "تیر", "مرد", "شهر", "مهر", "آبا", "آذر", "دی", "بهم", "اسف"][m - 1];
}
