import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import path from "node:path";
import {
  deleteLocalUpload,
  isLocalUploadPath,
  resolveLocalUploadPath,
  saveDataUrl,
  UploadError,
} from "../src/lib/upload";

test("isLocalUploadPath only accepts /uploads filenames", () => {
  assert.equal(isLocalUploadPath("/uploads/a.jpg"), true);
  assert.equal(isLocalUploadPath("https://cdn.example/a.jpg"), false);
  assert.equal(isLocalUploadPath("/uploads/../secret"), false);
  assert.equal(isLocalUploadPath(null), false);
});

test("deleteLocalUpload removes files under public/uploads", async () => {
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const filename = `test-delete-${Date.now()}.jpg`;
  const absolute = path.join(uploadsDir, filename);
  await writeFile(absolute, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

  assert.equal(resolveLocalUploadPath(`/uploads/${filename}`), absolute);
  assert.equal(await deleteLocalUpload(`/uploads/${filename}`), true);
  await assert.rejects(() => access(absolute));

  assert.equal(await deleteLocalUpload("https://images.example/a.jpg"), false);
  assert.equal(await deleteLocalUpload(`/uploads/${filename}`), false);
});

test("saveDataUrl accepts jpeg data URLs and rejects unknown formats", async () => {
  const tinyJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const dataUrl = `data:image/jpeg;base64,${tinyJpeg.toString("base64")}`;
  const saved = await saveDataUrl(dataUrl);
  assert.match(saved, /^\/uploads\/\d+-[a-z0-9]+\.jpg$/);

  const absolute = resolveLocalUploadPath(saved);
  assert.ok(absolute);
  const bytes = await readFile(absolute!);
  assert.deepEqual(bytes, tinyJpeg);
  await deleteLocalUpload(saved);

  await assert.rejects(
    () => saveDataUrl("data:image/heic;base64,AAAA"),
    (error: unknown) =>
      error instanceof UploadError && error.errorKey === "errors.invalidImage",
  );
});
