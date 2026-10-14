/** Resize/compress a captured product photo to a JPEG data URL for upload. */
export async function prepareProductPhoto(dataUrl: string): Promise<string> {
  const TARGET_BYTES = 1_500_000;
  const STEPS = [
    { maxEdge: 1920, quality: 0.88 },
    { maxEdge: 1600, quality: 0.82 },
    { maxEdge: 1280, quality: 0.76 },
    { maxEdge: 1024, quality: 0.7 },
  ];

  const blob = await fetch(dataUrl).then((response) => response.blob());
  const bitmap = await createImageBitmap(blob, {
    imageOrientation: "from-image",
  });

  try {
    let best = dataUrl;
    for (const step of STEPS) {
      const scale = Math.min(
        1,
        step.maxEdge / Math.max(bitmap.width, bitmap.height),
      );
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not prepare photo");
      ctx.drawImage(bitmap, 0, 0, width, height);
      best = canvas.toDataURL("image/jpeg", step.quality);
      const approxBytes = Math.floor(((best.length - 23) * 3) / 4);
      if (approxBytes <= TARGET_BYTES) {
        return best;
      }
    }
    return best;
  } finally {
    bitmap.close();
  }
}
