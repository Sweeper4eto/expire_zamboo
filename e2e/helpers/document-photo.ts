import sharp from "sharp";

/**
 * Synthetic "delivery note" photo. The upload path runs the real client-side
 * quality gate (size, brightness, glare, sharpness), so this has to look like a
 * sharp, evenly-lit page of text rather than a blank rectangle.
 */
function documentSvg(): string {
  const width = 1000;
  const height = 1400;
  const rows: string[] = [];

  for (let index = 0; index < 26; index += 1) {
    const y = 90 + index * 48;
    rows.push(
      `<text x="70" y="${y}" font-family="monospace" font-size="26" fill="#111111">` +
        `380012345${String(6000 + index).padStart(4, "0")}  ARTICLE-${index}  QTY ${1 + (index % 9)}  2026-1${index % 2}-1${index % 8}` +
        `</text>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="#d2d2d2" />
    <text x="70" y="50" font-family="monospace" font-size="34" fill="#000000">DELIVERY NOTE 4471</text>
    <rect x="60" y="62" width="880" height="3" fill="#000000" />
    ${rows.join("\n")}
  </svg>`;
}

export async function documentPhotoJpeg(): Promise<Buffer> {
  return sharp(Buffer.from(documentSvg())).jpeg({ quality: 92 }).toBuffer();
}
