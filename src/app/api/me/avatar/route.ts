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

import { execFile } from "child_process";
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handle, ServerError } from "@/lib/server/api-helpers";
import { requireUser, toPublicUser } from "@/lib/server/auth";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // ۵ مگابایت
const AVATAR_SIZE = 256; // displayed at ≤96px — 256 covers 2x+ retina
/**
 * Where the on-disk "uploads/" folder lives. In dev, Next serves
 * <cwd>/public/uploads directly; in standalone production, Next 16 only
 * reads the public/ index at boot, so uploads must live in a stable
 * directory (UPLOADS_ROOT, e.g. the project root) that nginx serves as
 * /uploads/ — which also keeps them alive across rebuilds.
 */
const UPLOADS_PARENT = process.env.UPLOADS_ROOT
  ? path.resolve(process.env.UPLOADS_ROOT)
  : path.join(process.cwd(), "public");
const AVATARS_DIR = path.join(UPLOADS_PARENT, "uploads", "avatars");

function absolutePath(avatarUrl: string): string | null {
  if (!avatarUrl.startsWith("/uploads/avatars/")) return null;
  // The value is server-generated (no user input) — still normalize defensively.
  return path.join(UPLOADS_PARENT, path.normalize(avatarUrl).replace(/^([/\\])+/, ""));
}

async function removeOldAvatarFile(avatarUrl: string | null): Promise<void> {
  if (!avatarUrl) return;
  const abs = absolutePath(avatarUrl);
  if (!abs || !abs.startsWith(AVATARS_DIR)) return;
  await unlink(abs).catch(() => {});
}

/**
 * Square-crop → 256×256 → WebP. Prefers sharp (local dev); if its native
 * binary can't run (some VM CPUs lack the x86-64-v2 baseline the prebuilt
 * libvips requires, e.g. the production host), falls back to the system
 * `vips` CLI (libvips-tools) which auto-rotates by EXIF and crops with the
 * same "attention" strategy.
 */
async function encodeAvatar(buffer: Buffer): Promise<Buffer> {
  try {
    const { default: sharp } = await import("sharp");
    return await sharp(buffer)
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "attention" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (err) {
    if (err instanceof ServerError) throw err;
    return encodeWithVips(buffer);
  }
}

async function encodeWithVips(buffer: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "avatar-"));
  try {
    const src = path.join(dir, "in");
    const out = path.join(dir, "out.webp");
    await writeFile(src, buffer);
    await new Promise<void>((resolve, reject) => {
      execFile(
        "vips",
        ["thumbnail", src, out, String(AVATAR_SIZE), "--crop", "attention"],
        { timeout: 20_000 },
        (err) => (err ? reject(err) : resolve()),
      );
    });
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
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
    let webp: Buffer;
    try {
      webp = await encodeAvatar(buffer);
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
