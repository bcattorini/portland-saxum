// Generates logo assets from the source JPEG:
//   public/logo-white.png     white wordmark on transparency (for the navy nav / dark panels)
//   public/icon-192.png       square app icon (original dark tile) — PWA
//   public/icon-512.png       square app icon — PWA
//   public/apple-touch-icon.png 180x180 — iOS home screen
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SRC = "C:/Users/soleg/Downloads/WhatsApp Image 2026-07-08 at 11.48.56.jpeg";
mkdirSync("public", { recursive: true });

const meta = await sharp(SRC).metadata();
console.log(`source: ${meta.width}x${meta.height} ${meta.format}`);

// background color = top-left pixel
const { data: corner } = await sharp(SRC).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
const bg = { r: corner[0], g: corner[1], b: corner[2] };
console.log(`bg color: rgb(${bg.r}, ${bg.g}, ${bg.b}) = #${[bg.r, bg.g, bg.b].map((n) => n.toString(16).padStart(2, "0")).join("")}`);

// 1) white transparent wordmark: alpha = luminance, RGB = white, then trim border
const { data: gray, info } = await sharp(SRC).grayscale().raw().toBuffer({ resolveWithObject: true });
const n = info.width * info.height;
const rgba = Buffer.alloc(n * 4);
// Floor the dark background to fully transparent; stretch the rest so white text
// stays opaque and anti-aliased edges stay smooth.
const THRESH = 60;
for (let i = 0; i < n; i++) {
  const lum = gray[i];
  const a = lum <= THRESH ? 0 : Math.min(255, Math.round(((lum - THRESH) * 255) / (255 - THRESH)));
  rgba[i * 4] = 255;
  rgba[i * 4 + 1] = 255;
  rgba[i * 4 + 2] = 255;
  rgba[i * 4 + 3] = a;
}
await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
  .trim({ threshold: 10 })
  .png()
  .toFile("public/logo-white.png");
console.log("wrote public/logo-white.png");

// 2) square app icons on the brand-dark tile (contain so wordmark never gets cropped)
const bgObj = { r: bg.r, g: bg.g, b: bg.b, alpha: 1 };
for (const size of [192, 512]) {
  await sharp(SRC).resize(size, size, { fit: "contain", background: bgObj }).png().toFile(`public/icon-${size}.png`);
  console.log(`wrote public/icon-${size}.png`);
}
await sharp(SRC).resize(180, 180, { fit: "contain", background: bgObj }).png().toFile("public/apple-touch-icon.png");
console.log("wrote public/apple-touch-icon.png");
