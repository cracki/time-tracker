/**
 * POST   /api/me/avatar — upload the signed-in user's avatar (multipart "file").
 * DELETE /api/me/avatar — remove it (falls back to the initials avatar).
 *
 * The image is validated (≤5MB, image/*), center-cropped to a square,
 * resized to 256×256 and re-encoded as WebP (~q80) so the stored file is
 * a few KB regardless of the original. Stored under public/uploads/avatars
 * and served as a static file; the filename carries a timestamp so a new
 * upload always busts the browser cache.
 */

import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { db } from "@/lib/db";
import { handle, ServerError } from "@/lib/server/api-helpers";
import { requireUser, toPublicUser } from "@/lib/server/auth";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // ۵ مگابایت
const AVATAR_SIZE = 256; // displayed at ≤96px — 256 covers 2x+ retina
const PUBLIC_DIR = path.join(process.cwd(), "public");
const AVATARS_DIR = path.join(PUBLIC_DIR, "uploads", "avatars");

function absolutePath(avatarUrl: string): string | null {
  if (!avatarUrl.startsWith("/uploads/avatars/")) return null;
  // The value is server-generated (no user input) — still normalize defensively.
  return path.join(PUBLIC_DIR, path.normalize(avatarUrl).replace(/^([/\\])+/, ""));
}

async function removeOldAvatarFile(avatarUrl: string | null): Promise<void> {
  if (!avatarUrl) return;
  const abs = absolutePath(avatarUrl);
  if (!abs || !abs.startsWith(AVATARS_DIR)) return;
  await unlink(abs).catch(() => {});
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      throw new ServerError("فایل آواتار ارسال نشد.", "validation");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new ServerError("حجم تصویر باید حداکثر ۵ مگابایت باشد.", "validation");
    }
    if (file.type && !file.type.startsWith("image/")) {
      throw new ServerError("فقط فایل تصویری قابل قبول است.", "validation");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    // rotate() respects EXIF orientation; "cover" crops to a square — a
    // non-square photo is center-cropped, so we never distort it.
    let webp: Buffer;
    try {
      webp = await sharp(buffer)
        .rotate()
        .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "attention" })
        .webp({ quality: 80 })
        .toBuffer();
    } catch {
      throw new ServerError("تصویر قابل پردازش نیست — فایل دیگری انتخاب کنید.", "validation");
    }

    await mkdir(AVATARS_DIR, { recursive: true });
    const filename = `${user.id}-${Date.now()}.webp`;
    await writeFile(path.join(AVATARS_DIR, filename), webp);

    const updated = await db.user.update({
      where: { id: user.id },
      data: { avatarUrl: `/uploads/avatars/${filename}` },
    });
    await removeOldAvatarFile(user.avatarUrl);

    return NextResponse.json({ user: toPublicUser(updated) });
  });
}

export async function DELETE() {
  return handle(async () => {
    const user = await requireUser();
    const updated = await db.user.update({
      where: { id: user.id },
      data: { avatarUrl: null },
    });
    await removeOldAvatarFile(user.avatarUrl);
    return NextResponse.json({ user: toPublicUser(updated) });
  });
}
