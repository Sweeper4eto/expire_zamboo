/**
 * Facebook Page cover from real design mockups (not AI-generated UI).
 * Output: assets/facebook-cover-expire365.png (1640×630, ~2.6:1)
 */
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const out = path.join(root, "assets/facebook-cover-expire365.png");

const W = 1640;
const H = 630;

const expirySrc = path.join(root, "design/final/21-store-expiry-list.png");
const homeSrc = path.join(root, "design/final/20-store-owner-home.png");
const logoSrc = path.join(root, "public/icons/icon-512.png");

const phoneH = 560;
const phoneW = Math.round(phoneH * (1024 / 1536));
const homeScale = 0.88;
const homeH = Math.round(phoneH * homeScale);
const homeW = Math.round(phoneW * homeScale);

async function phoneScreen(src, width, height, radius = 28) {
  const resized = await sharp(src)
    .resize(width, height, { fit: "cover" })
    .png()
    .toBuffer();
  const mask = Buffer.from(
    `<svg width="${width}" height="${height}"><rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="white"/></svg>`,
  );
  return sharp(resized).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

const bgSvg = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#09090b"/>
      <stop offset="55%" stop-color="#0c1210"/>
      <stop offset="100%" stop-color="#09090b"/>
    </linearGradient>
    <radialGradient id="glow" cx="75%" cy="45%" r="45%">
      <stop offset="0%" stop-color="#2dd4a8" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#2dd4a8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
</svg>`);

const copySvg = Buffer.from(`
<svg width="720" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <text x="156" y="214" fill="#ffffff" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="56" font-weight="600">expire<tspan fill="#2dd4a8">365</tspan></text>
  <text x="72" y="292" fill="#e4e4e7" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="32" font-weight="600">Track expiry</text>
  <text x="72" y="334" fill="#2dd4a8" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="32" font-weight="600">before it costs you</text>
  <text x="72" y="388" fill="#a1a1aa" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="21">Scan · expiry list · push alerts</text>
  <text x="72" y="418" fill="#a1a1aa" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="21">Multi-store stock for shops and homes.</text>
</svg>`);

const expiryX = W - phoneW - 72;
const expiryY = Math.round((H - phoneH) / 2);
const homeX = expiryX - homeW + 48;
const homeY = expiryY + phoneH - homeH - 8;

const [expiryPhone, homePhone, logo] = await Promise.all([
  phoneScreen(expirySrc, phoneW, phoneH),
  phoneScreen(homeSrc, homeW, homeH, 24),
  sharp(logoSrc).resize(72, 72).png().toBuffer(),
]);

const shadowSvg = (x, y, w, h, r, opacity = 0.35) =>
  Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${x + 6}" y="${y + 10}" width="${w}" height="${h}" rx="${r}" fill="#000000" opacity="${opacity}"/>
</svg>`);

await sharp(bgSvg)
  .composite([
    { input: await sharp(shadowSvg(homeX, homeY, homeW, homeH, 24, 0.45)).png().toBuffer(), left: 0, top: 0 },
    { input: homePhone, left: homeX, top: homeY },
    { input: await sharp(shadowSvg(expiryX, expiryY, phoneW, phoneH, 28, 0.5)).png().toBuffer(), left: 0, top: 0 },
    { input: expiryPhone, left: expiryX, top: expiryY },
    { input: copySvg, left: 0, top: 0 },
    { input: logo, left: 72, top: 168 },
  ])
  .png()
  .toFile(out);

console.log("wrote", out);
