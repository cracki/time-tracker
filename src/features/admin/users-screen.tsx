"use client";

/**
 * Users Management (admin) — create, edit, activate/deactivate, delete.
 * Backed by /api/admin/users (server enforces self-lockout, last-admin
 * and has-logs protections). Mobile-first: list + bottom-sheet forms.
 */

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ShieldCheck, UserPlus, UserRoundX, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { LogListSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ApiError, usersApi, ManagedUser } from "@/lib/api";
import { UserAvatar } from "@/components/shared/time-log-card";
import { useAuth } from "@/providers/auth-provider";
import { toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = [
  "#0F766E", "#B45309", "#7C3AED", "#BE185D", "#15803D",
  "#B91C1C", "#A16207", "#4D7C0F", "#9333EA", "#0E7490",
];

interface FormState {
  name: string;
  mobile: string;
  role: "admin" | "collaborator";
  avatarColor: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  mobile: "",
  role: "collaborator",
  avatarColor: AVATAR_COLORS[0],
  isActive: true,
};

export function UsersScreen() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [deleting, setDeleting] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: users, isLoading, isError, refetch } = useQuery({
    queryKey: ["users-managed"],
    queryFn: () => usersApi.getAll(),
  });

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return users ?? [];
    return (users ?? []).filter(
      (u) => u.name.includes(q) || u.mobile.includes(q) || toPersianDigits(q) !== q && u.mobile.includes(toPersianDigits(q)),
    );
  }, [users, search]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setCreateOpen(true);
  };

  const openEdit = (u: ManagedUser) => {
    setForm({ name: u.name, mobile: u.mobile, role: u.role, avatarColor: u.avatarColor, isActive: u.isActive });
    setFormError(null);
    setEditing(u);
  };

  const submitCreate = async () => {
    setSaving(true);
    setFormError(null);
    try {
      await usersApi.create({ name: form.name, mobile: form.mobile, role: form.role, avatarColor: form.avatarColor });
      toast.success("کاربر جدید ایجاد شد.");
      setCreateOpen(false);
      void qc.invalidateQueries({ queryKey: ["users-managed"] });
      void qc.invalidateQueries({ queryKey: ["users"] });
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "ایجاد کاربر ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async () => {
    if (!editing) return;
    setSaving(true);
    setFormError(null);
    try {
      await usersApi.update(editing.id, {
        name: form.name,
        mobile: form.mobile,
        role: form.role,
        isActive: form.isActive,
        avatarColor: form.avatarColor,
      });
      toast.success("تغییرات ذخیره شد.");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["users-managed"] });
      void qc.invalidateQueries({ queryKey: ["users"] });
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "ذخیره تغییرات ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await usersApi.remove(deleting.id);
      toast.success("کاربر حذف شد.");
      setDeleting(null);
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["users-managed"] });
      void qc.invalidateQueries({ queryKey: ["users"] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "حذف ناموفق بود.");
    } finally {
      setSaving(false);
    }
  };

  const isSelf = (u: ManagedUser | null | undefined) => !!u && u.id === me?.id;

  const userForm = (
    <div className="space-y-4 px-6 pb-6">
      <div>
        <Label htmlFor="u-name" className="mb-1.5 block text-sm font-semibold">نام و نام خانوادگی</Label>
        <Input
          id="u-name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="مثلاً: مریم احمدی"
          className="h-12 rounded-xl bg-card"
        />
      </div>
      <div>
        <Label htmlFor="u-mobile" className="mb-1.5 block text-sm font-semibold">شماره موبایل</Label>
        <Input
          id="u-mobile"
          inputMode="numeric"
          dir="ltr"
          value={toPersianDigits(form.mobile)}
          onChange={(e) => {
            const d = e.target.value.replace(/[۰-۹]/g, (ch) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(ch))).replace(/\D/g, "").slice(0, 11);
            setForm((f) => ({ ...f, mobile: d }));
          }}
          placeholder="09123456789"
          className="h-12 rounded-xl bg-card text-center text-base font-bold nums tracking-widest"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">با این شماره، کد ورود پیامک/نمایش داده می‌شود.</p>
      </div>
      <div>
        <Label className="mb-1.5 block text-sm font-semibold">نقش</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, role: "collaborator" }))}
            className={cn(
              "h-12 rounded-xl border text-sm font-bold transition-colors",
              form.role === "collaborator" ? "border-primary bg-accent text-accent-foreground" : "bg-card text-muted-foreground",
            )}
          >
            همکار
          </button>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, role: "admin" }))}
            className={cn(
              "flex h-12 items-center justify-center gap-1.5 rounded-xl border text-sm font-bold transition-colors",
              form.role === "admin" ? "border-primary bg-accent text-accent-foreground" : "bg-card text-muted-foreground",
            )}
          >
            <ShieldCheck className="size-4" aria-hidden />
            مدیر
          </button>
        </div>
      </div>
      <div>
        <Label className="mb-1.5 block text-sm font-semibold">رنگ آواتار</Label>
        <div className="flex flex-wrap gap-2">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`رنگ ${c}`}
              onClick={() => setForm((f) => ({ ...f, avatarColor: c }))}
              className={cn(
                "size-9 rounded-full transition-transform",
                form.avatarColor === c ? "scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-background" : "",
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {formError ? <p className="text-xs font-medium text-danger" role="alert">{formError}</p> : null}

      <Button
        onClick={editing ? submitEdit : submitCreate}
        disabled={saving || !form.name.trim() || form.mobile.length !== 11}
        className="h-13 w-full rounded-xl text-base font-bold"
      >
        {saving ? "در حال ذخیره…" : editing ? "ذخیره تغییرات" : "ایجاد کاربر"}
      </Button>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="مدیریت کاربران"
        subtitle={users ? `${toPersianDigits(users.length)} کاربر` : undefined}
        actions={
          <Button size="sm" onClick={openCreate} className="h-10 rounded-xl font-bold">
            <UserPlus className="size-4" aria-hidden />
            کاربر جدید
          </Button>
        }
      />

      <div className="relative mb-4">
        <Search className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جستجوی نام یا شماره…"
          aria-label="جستجوی کاربر"
          className="h-11 rounded-xl bg-card pr-10"
        />
      </div>

      {isLoading ? (
        <LogListSkeleton count={6} />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={UserRoundX} title="کاربری پیدا نشد." description={search ? "عبارت جستجو را تغییر دهید." : "اولین کاربر را ایجاد کنید."} />
      ) : (
        <div className="space-y-2.5 pb-6">
          {filtered.map((u) => (
            <button
              key={u.id}
              onClick={() => openEdit(u)}
              className="flex w-full items-center gap-3 rounded-2xl border bg-card p-3.5 text-right app-shadow transition-colors hover:border-primary/35 active:bg-accent/30"
              aria-label={`ویرایش ${u.name}`}
            >
              <UserAvatar user={u} className="size-11 shrink-0 text-sm" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className={cn("truncate text-sm font-bold", !u.isActive && "text-muted-foreground line-through")}>
                    {u.name}
                  </span>
                  {u.role === "admin" ? (
                    <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
                      <ShieldCheck className="size-3" aria-hidden />
                      مدیر
                    </span>
                  ) : null}
                  {isSelf(u) ? (
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">شما</span>
                  ) : null}
                </span>
                <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="nums" dir="ltr">{toPersianDigits(u.mobile)}</span>
                  <span>•</span>
                  <span className="nums">{toPersianDigits(u.logCount)} گزارش</span>
                  {!u.isActive ? (
                    <>
                      <span>•</span>
                      <span className="font-bold text-warning">غیرفعال</span>
                    </>
                  ) : null}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Create sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl px-0 pb-3">
          <SheetHeader className="px-6 pb-2 text-right">
            <SheetTitle className="text-base font-extrabold">کاربر جدید</SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              پس از ایجاد، کاربر با شماره موبایل می‌تواند وارد شود.
            </SheetDescription>
          </SheetHeader>
          {userForm}
        </SheetContent>
      </Sheet>

      {/* Edit sheet */}
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl px-0 pb-3">
          <SheetHeader className="px-6 pb-2 text-right">
            <SheetTitle className="text-base font-extrabold">ویرایش کاربر</SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              {editing?.name}
            </SheetDescription>
          </SheetHeader>

          {userForm}

          <div className="mt-2 space-y-3 border-t px-6 pt-4">
            {/* activate/deactivate — hidden for self (lockout guard) */}
            <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3">
              <div>
                <p className="text-sm font-bold">فعال</p>
                <p className="text-[11px] text-muted-foreground">کاربر غیرفعال نمی‌تواند وارد شود.</p>
              </div>
              <Switch
                checked={form.isActive}
                disabled={isSelf(editing!)}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                aria-label="فعال بودن کاربر"
              />
            </div>

            {!isSelf(editing!) ? (
              <Button
                variant="outline"
                onClick={() => setDeleting(editing)}
                disabled={saving}
                className="h-12 w-full rounded-xl border-danger/40 text-danger hover:bg-danger-soft"
              >
                <Trash2 className="size-4" aria-hidden />
                حذف کاربر
              </Button>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle>حذف این کاربر؟</AlertDialogTitle>
            <AlertDialogDescription>
              حساب «{deleting?.name}» برای همیشه حذف می‌شود. اگر گزارش ثبت‌شده دارد، حذف ممکن نیست و باید حساب غیرفعال شود.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-danger text-white hover:bg-danger/90"
            >
              حذف
            </AlertDialogAction>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
