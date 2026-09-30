/**
 * Build all PWA icon sizes from the AI-generated base (1024x1024).
 * Keeps the exact filenames the manifest/layout already reference.
 * Run: node scripts/build-icons.mjs
 */
import sharp from "sharp";
import { copyFileSync } from "fs";

const BASE = "/home/z/my-project/scripts/icon-ai-base.png";
const OUT = "/home/z/my-project/public/icons";

async function run() {
  // Standard square icons (launcher / favicon)
  await sharp(BASE).resize(512, 512).png({ compressionLevel: 9 }).toFile(`${OUT}/icon-512.png`);
  await sharp(BASE).resize(192, 192).png({ compressionLevel: 9 }).toFile(`${OUT}/icon-192.png`);

  // Maskable: full-bleed background required; glyph already sits within the
  // inner 80% safe zone of the AI art → straight resize is safe.
  await sharp(BASE).resize(512, 512).png({ compressionLevel: 9 }).toFile(`${OUT}/maskable-512.png`);

  // Apple touch icon (Apple rounds it automatically; keep full-bleed square)
  await sharp(BASE).resize(180, 180).png({ compressionLevel: 9 }).toFile(`${OUT}/apple-touch-icon.png`);

  // Favicons — light sharpening at tiny sizes
  await sharp(BASE).resize(64, 64).sharpen({ sigma: 0.6 }).png().toFile(`${OUT}/favicon-64.png`);
  await sharp(BASE).resize(32, 32).sharpen({ sigma: 0.8 }).png().toFile(`${OUT}/favicon-32.png`);

  // Keep the original AI art as a user-facing deliverable
  copyFileSync(BASE, "/home/z/my-project/download/app-icon-ai-1024.png");

  console.log("icons rebuilt ✓");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
