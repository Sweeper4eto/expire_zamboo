import sharp from "sharp";
import { writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const src = path.join(root, "public/icons/icon-source-1024.png");

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
/** App chrome background — mint logo sits on this for Apple / PWA / push tiles. */
const appBlack = { r: 9, g: 9, b: 11, alpha: 1 };

async function png(size, rel, background = transparent) {
  const out = path.join(root, rel);
  await sharp(src)
    .ensureAlpha()
    .resize(size, size, { fit: "contain", background })
    .png()
    .toFile(out);
  console.log("wrote", rel);
}

/** Mint mark inset on opaque black (home screen, maskable, push). */
async function brandOnBlack(size, rel, inset = 0.72) {
  const inner = Math.round(size * inset);
  const mark = await sharp(src)
    .ensureAlpha()
    .resize(inner, inner, { fit: "contain", background: transparent })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: appBlack },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(path.join(root, rel));
  console.log("wrote", rel);
}

// Transparent for UI / favicon / in-app display icons
const transparentOutputs = [
  ["public/icons/icon-16.png", 16],
  ["public/icons/icon-32.png", 32],
  ["public/icons/favicon.png", 32],
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["src/app/icon.png", 512],
];

for (const [rel, size] of transparentOutputs) {
  await png(size, rel, transparent);
}

// Push: color tile for notification `icon`; monochrome silhouette for Android `badge`
// (Chrome ignores colored badges and falls back to a generic calendar glyph).
await brandOnBlack(192, "public/icons/icon-notification.png");
{
  const badgeRel = "public/icons/icon-badge.png";
  const badgeSize = 72;
  const { data, info } = await sharp(src)
    .ensureAlpha()
    .resize(badgeSize, badgeSize, { fit: "contain", background: transparent })
    .raw()
    .toBuffer({ resolveWithObject: true });
  // Pure white + binary alpha — Chrome Android rejects soft greyscale badges.
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = a > 40 ? 255 : 0;
  }
  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(path.join(root, badgeRel));
  console.log("wrote", badgeRel);
}

// Apple home-screen + Next apple-icon — opaque black, not white
await brandOnBlack(180, "public/icons/apple-touch-icon.png");
await brandOnBlack(180, "src/app/apple-icon.png");

// Android maskable safe-zone on black
await brandOnBlack(512, "public/icons/icon-512-maskable.png");

async function writeIco(rel) {
  const sizes = [16, 32, 48];
  const images = [];
  for (const size of sizes) {
    images.push(
      await sharp(src)
        .ensureAlpha()
        .resize(size, size, { fit: "contain", background: transparent })
        .png()
        .toBuffer(),
    );
  }

  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = [];
  let offset = 6 + count * 16;
  const payloads = [];
  for (let i = 0; i < count; i++) {
    const size = sizes[i];
    const pngBuf = images[i];
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(pngBuf.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    payloads.push(pngBuf);
    offset += pngBuf.length;
  }

  writeFileSync(path.join(root, rel), Buffer.concat([header, ...entries, ...payloads]));
  console.log("wrote", rel);
}

await writeIco("public/favicon.ico");
await writeIco("src/app/favicon.ico");
