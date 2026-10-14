import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcPath = path.join(root, "public/icons/icon-source-1024.png");

/** Soft light mint green brand fill */
const TARGET = { r: 0x34, g: 0xd3, b: 0x99 }; // #34d399

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

const targetHsl = rgbToHsl(TARGET.r, TARGET.g, TARGET.b);

const { data, info } = await sharp(srcPath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

for (let i = 0; i < data.length; i += 4) {
  const a = data[i + 3];
  if (a < 8) continue;
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (r + g + b < 45) continue;
  if (r > 240 && g > 240 && b > 240) continue;

  const { s, l } = rgbToHsl(r, g, b);
  if (s < 0.12) continue;

  const nextL = Math.min(0.72, Math.max(0.28, l * 0.55 + targetHsl.l * 0.45));
  const nextS = Math.min(0.75, Math.max(0.45, s * 0.35 + targetHsl.s * 0.65));
  const next = hslToRgb(targetHsl.h, nextS, nextL);
  data[i] = next.r;
  data[i + 1] = next.g;
  data[i + 2] = next.b;
}

await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .png()
  .toFile(srcPath);

console.log("recolored", srcPath);