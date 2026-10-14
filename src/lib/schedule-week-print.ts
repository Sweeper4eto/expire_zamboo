import {
  addDaysYmd,
  formatDurationMinutes,
  formatMinutesAsClock,
  parseYmd,
} from "@/lib/schedule";

export type SchedulePrintStaff = {
  id: string;
  username: string;
  displayName?: string | null;
};

export type SchedulePrintShift = {
  userId: string;
  dayIndex: number;
  startMin: number;
  endMin: number;
};

export type SchedulePrintDay = {
  dayIndex: number;
  status: "DRAFT" | "FINALIZED";
  excludedUserIds: string[];
};

export type ScheduleWeekPrintLabels = {
  title: string;
  storeLabel: string;
  weekLabel: string;
  personColumn: string;
  fromColumn: string;
  toColumn: string;
  durationColumn: string;
  /** Finalized day with no shifts. */
  noShifts: string;
  /** Day not finalized yet — do not list draft shifts. */
  noSchedule: string;
  dayNames: string[];
  hoursUnit: string;
  minutesUnit: string;
  printHint: string;
};

export type ScheduleWeekPrintArgs = {
  weekStart: string;
  storeName: string;
  staff: SchedulePrintStaff[];
  shifts: SchedulePrintShift[];
  days: SchedulePrintDay[];
  labels: ScheduleWeekPrintLabels;
};

const PRINT_WIDTH_PX = 800;
const PNG_SCALE = 2;
const PNG_PAD = 24;
const PNG_ROW_H = 28;
const PNG_TITLE_SIZE = 22;
const PNG_META_SIZE = 14;
const PNG_DAY_SIZE = 16;
const PNG_CELL_SIZE = 13;

const PRINT_CSS = `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: "Segoe UI", system-ui, sans-serif;
      color: #111;
      background: #fff;
      font-size: 13px;
      line-height: 1.35;
    }
    h1 { font-size: 1.35rem; margin: 0 0 4px; }
    .meta { color: #444; margin: 0 0 16px; font-size: 0.95rem; }
    .day { margin: 0 0 18px; break-inside: avoid; page-break-inside: avoid; }
    .day h2 {
      font-size: 1.05rem;
      margin: 0 0 6px;
      padding-bottom: 4px;
      border-bottom: 2px solid #111;
    }
    .day h2 .date { font-weight: 500; color: #555; font-size: 0.9rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td {
      border: 1px solid #bbb;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    th { background: #f0f0f0; font-weight: 600; }
    td.num, th:nth-child(n+2) { text-align: center; white-space: nowrap; }
    td.empty, p.empty { color: #666; font-style: italic; text-align: center; margin: 8px 0; }
    @media print {
      body { padding: 0; }
      .day { break-inside: avoid; page-break-inside: avoid; }
    }
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDateLabel(ymd: string): string {
  const d = parseYmd(ymd);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function staffLabel(staff: SchedulePrintStaff): string {
  return staff.displayName?.trim() || staff.username;
}

function buildWeekBodyHtml(args: ScheduleWeekPrintArgs): {
  weekRange: string;
  bodyInnerHtml: string;
} {
  const { weekStart, storeName, staff, shifts, days, labels } = args;
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const dayByIndex = new Map(days.map((d) => [d.dayIndex, d]));
  const weekEnd = addDaysYmd(weekStart, 6);
  const weekRange = `${formatDateLabel(weekStart)} – ${formatDateLabel(weekEnd)}`;

  const daySections = labels.dayNames
    .map((dayName, dayIndex) => {
      const dateYmd = addDaysYmd(weekStart, dayIndex);
      const day = dayByIndex.get(dayIndex);
      const finalized = day?.status === "FINALIZED";

      let body: string;
      if (!finalized) {
        body = `<p class="empty">${escapeHtml(labels.noSchedule)}</p>`;
      } else {
        const excluded = new Set(day?.excludedUserIds ?? []);
        const dayShifts = shifts
          .filter(
            (s) =>
              s.dayIndex === dayIndex &&
              !excluded.has(s.userId) &&
              s.endMin > s.startMin,
          )
          .sort(
            (a, b) =>
              a.startMin - b.startMin || a.userId.localeCompare(b.userId),
          );

        const rows =
          dayShifts.length === 0
            ? `<tr><td colspan="4" class="empty">${escapeHtml(labels.noShifts)}</td></tr>`
            : dayShifts
                .map((shift) => {
                  const person = staffById.get(shift.userId);
                  const name = person ? staffLabel(person) : shift.userId;
                  const duration = formatDurationMinutes(
                    shift.endMin - shift.startMin,
                    labels.hoursUnit,
                    labels.minutesUnit,
                  );
                  return `<tr>
                  <td>${escapeHtml(name)}</td>
                  <td class="num">${escapeHtml(formatMinutesAsClock(shift.startMin))}</td>
                  <td class="num">${escapeHtml(formatMinutesAsClock(shift.endMin))}</td>
                  <td class="num">${escapeHtml(duration)}</td>
                </tr>`;
                })
                .join("");

        body = `<table>
          <thead>
            <tr>
              <th>${escapeHtml(labels.personColumn)}</th>
              <th>${escapeHtml(labels.fromColumn)}</th>
              <th>${escapeHtml(labels.toColumn)}</th>
              <th>${escapeHtml(labels.durationColumn)}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
      }

      return `<section class="day">
        <h2>${escapeHtml(dayName)} <span class="date">${escapeHtml(formatDateLabel(dateYmd))}</span></h2>
        ${body}
      </section>`;
    })
    .join("");

  const bodyInnerHtml = `
  <h1>${escapeHtml(labels.title)}</h1>
  <p class="meta">
    ${escapeHtml(labels.storeLabel)}: <strong>${escapeHtml(storeName || "—")}</strong><br />
    ${escapeHtml(labels.weekLabel)}: <strong>${escapeHtml(weekRange)}</strong>
  </p>
  ${daySections}`;

  return { weekRange, bodyInnerHtml };
}

/** Build printable HTML for one week of assigned shifts. */
export function buildScheduleWeekPrintHtml(args: ScheduleWeekPrintArgs): string {
  const { weekRange, bodyInnerHtml } = buildWeekBodyHtml(args);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(args.labels.title)} — ${escapeHtml(weekRange)}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
${bodyInnerHtml}
</body>
</html>`;
}

function mountPrintIframe(html: string, widthPx: number): HTMLIFrameElement | null {
  if (typeof document === "undefined") return null;

  const existing = document.getElementById("schedule-week-print-frame");
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "schedule-week-print-frame";
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.left = "0";
  iframe.style.top = "0";
  iframe.style.width = `${widthPx}px`;
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.zIndex = "-1";
  document.body.appendChild(iframe);

  const frameDoc = iframe.contentWindow?.document;
  if (!frameDoc) {
    iframe.remove();
    return null;
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();
  return iframe;
}

/**
 * Open the system print dialog for the week table (Save as PDF / print).
 * Uses a hidden iframe so it works in DevTools device mode without pop-ups.
 */
export function openScheduleWeekPrint(args: ScheduleWeekPrintArgs): boolean {
  const html = buildScheduleWeekPrintHtml(args);
  const iframe = mountPrintIframe(html, 0);
  if (!iframe) return false;

  const frameWindow = iframe.contentWindow;
  if (!frameWindow) {
    iframe.remove();
    return false;
  }

  const triggerPrint = () => {
    try {
      frameWindow.focus();
      frameWindow.print();
    } finally {
      window.setTimeout(() => {
        iframe.remove();
      }, 1000);
    }
  };

  // srcdoc/write may still be loading styles; small delay keeps print reliable.
  window.setTimeout(triggerPrint, 250);
  return true;
}

type DayExportBlock =
  | { kind: "empty"; dayTitle: string; message: string }
  | {
      kind: "table";
      dayTitle: string;
      headers: [string, string, string, string];
      rows: Array<[string, string, string, string]>;
    };

function buildDayExportBlocks(args: ScheduleWeekPrintArgs): {
  weekRange: string;
  blocks: DayExportBlock[];
} {
  const { weekStart, staff, shifts, days, labels } = args;
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const dayByIndex = new Map(days.map((d) => [d.dayIndex, d]));
  const weekEnd = addDaysYmd(weekStart, 6);
  const weekRange = `${formatDateLabel(weekStart)} – ${formatDateLabel(weekEnd)}`;
  const headers: [string, string, string, string] = [
    labels.personColumn,
    labels.fromColumn,
    labels.toColumn,
    labels.durationColumn,
  ];

  const blocks: DayExportBlock[] = labels.dayNames.map((dayName, dayIndex) => {
    const dateYmd = addDaysYmd(weekStart, dayIndex);
    const dayTitle = `${dayName} ${formatDateLabel(dateYmd)}`;
    const day = dayByIndex.get(dayIndex);
    if (day?.status !== "FINALIZED") {
      return { kind: "empty", dayTitle, message: labels.noSchedule };
    }
    const excluded = new Set(day.excludedUserIds ?? []);
    const dayShifts = shifts
      .filter(
        (s) =>
          s.dayIndex === dayIndex &&
          !excluded.has(s.userId) &&
          s.endMin > s.startMin,
      )
      .sort(
        (a, b) =>
          a.startMin - b.startMin || a.userId.localeCompare(b.userId),
      );
    if (dayShifts.length === 0) {
      return { kind: "empty", dayTitle, message: labels.noShifts };
    }
    const rows: Array<[string, string, string, string]> = dayShifts.map(
      (shift) => {
        const person = staffById.get(shift.userId);
        const name = person ? staffLabel(person) : shift.userId;
        return [
          name,
          formatMinutesAsClock(shift.startMin),
          formatMinutesAsClock(shift.endMin),
          formatDurationMinutes(
            shift.endMin - shift.startMin,
            labels.hoursUnit,
            labels.minutesUnit,
          ),
        ];
      },
    );
    return { kind: "table", dayTitle, headers, rows };
  });

  return { weekRange, blocks };
}

/** Sync PNG blob so we can call navigator.share in the same user-gesture turn. */
function canvasToPngBlobSync(canvas: HTMLCanvasElement): Blob {
  const dataUrl = canvas.toDataURL("image/png");
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("toDataURL-failed");
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: "image/png" });
}

function uniquePngFilename(weekStart: string): string {
  const now = new Date();
  const stamp = [
    pad2(now.getHours()),
    pad2(now.getMinutes()),
    pad2(now.getSeconds()),
  ].join("");
  // Unique name each save so phones/browsers don't keep showing the previous PNG.
  return `schedule-${weekStart}-${stamp}.png`;
}

export type SchedulePngDeliverResult = "ok" | "cancelled" | "failed";

async function deliverPngBlob(
  blob: Blob,
  filename: string,
): Promise<SchedulePngDeliverResult> {
  const file = new File([blob], filename, { type: "image/png" });

  // Phones: Web Share is the reliable path (iOS/Android often ignore <a download>).
  // Must stay in the user-gesture chain — no prior await fetch / toBlob.
  try {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      (!navigator.canShare || navigator.canShare({ files: [file] }))
    ) {
      await navigator.share({ files: [file], title: filename });
      return "ok";
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return "cancelled";
    }
    // NotAllowedError / other — fall through to <a download>.
  }

  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    // iOS/Android often ignore <a download> — open the image so the user can save it.
    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (mobile) {
      window.setTimeout(() => {
        try {
          window.open(url, "_blank", "noopener,noreferrer");
        } catch {
          /* ignore */
        }
      }, 350);
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return "ok";
  } catch {
    URL.revokeObjectURL(url);
    return "failed";
  }
}

function measurePngHeight(blocks: DayExportBlock[]): number {
  let y = PNG_PAD;
  y += PNG_TITLE_SIZE + 8;
  y += PNG_META_SIZE + 4;
  y += PNG_META_SIZE + 20;
  for (const block of blocks) {
    y += PNG_DAY_SIZE + 10;
    if (block.kind === "empty") {
      y += PNG_ROW_H + 18;
    } else {
      y += PNG_ROW_H * (1 + block.rows.length) + 18;
    }
  }
  return y + PNG_PAD;
}

function drawScheduleWeekPng(args: ScheduleWeekPrintArgs): HTMLCanvasElement {
  const { labels, storeName } = args;
  const { weekRange, blocks } = buildDayExportBlocks(args);
  const width = PRINT_WIDTH_PX;
  const height = measurePngHeight(blocks);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * PNG_SCALE);
  canvas.height = Math.ceil(height * PNG_SCALE);
  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) throw new Error("no-2d-context");
  const ctx: CanvasRenderingContext2D = maybeCtx;

  ctx.scale(PNG_SCALE, PNG_SCALE);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = "middle";

  const contentLeft = PNG_PAD;
  const contentWidth = width - PNG_PAD * 2;
  const colWidths = [
    Math.floor(contentWidth * 0.4),
    Math.floor(contentWidth * 0.2),
    Math.floor(contentWidth * 0.2),
    Math.floor(contentWidth * 0.2),
  ];
  // Fix rounding so columns fill the row exactly.
  colWidths[3] = contentWidth - colWidths[0]! - colWidths[1]! - colWidths[2]!;

  let y = PNG_PAD;

  ctx.fillStyle = "#111111";
  ctx.font = `600 ${PNG_TITLE_SIZE}px system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(labels.title, contentLeft, y + PNG_TITLE_SIZE / 2);
  y += PNG_TITLE_SIZE + 8;

  ctx.fillStyle = "#444444";
  ctx.font = `${PNG_META_SIZE}px system-ui, sans-serif`;
  ctx.fillText(
    `${labels.storeLabel}: ${storeName || "—"}`,
    contentLeft,
    y + PNG_META_SIZE / 2,
  );
  y += PNG_META_SIZE + 4;
  ctx.fillText(
    `${labels.weekLabel}: ${weekRange}`,
    contentLeft,
    y + PNG_META_SIZE / 2,
  );
  y += PNG_META_SIZE + 20;

  function drawCell(
    text: string,
    x: number,
    rowTop: number,
    cellW: number,
    opts?: { header?: boolean; center?: boolean; muted?: boolean },
  ) {
    ctx.strokeStyle = "#bbbbbb";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, rowTop + 0.5, cellW - 1, PNG_ROW_H - 1);
    if (opts?.header) {
      ctx.fillStyle = "#f0f0f0";
      ctx.fillRect(x + 1, rowTop + 1, cellW - 2, PNG_ROW_H - 2);
    }
    ctx.fillStyle = opts?.muted ? "#666666" : "#111111";
    ctx.font = `${opts?.header ? "600 " : ""}${PNG_CELL_SIZE}px system-ui, sans-serif`;
    ctx.textAlign = opts?.center ? "center" : "left";
    const tx = opts?.center ? x + cellW / 2 : x + 8;
    const maxW = cellW - 16;
    let draw = text;
    if (ctx.measureText(draw).width > maxW) {
      while (draw.length > 1 && ctx.measureText(`${draw}…`).width > maxW) {
        draw = draw.slice(0, -1);
      }
      draw = `${draw}…`;
    }
    ctx.fillText(draw, tx, rowTop + PNG_ROW_H / 2, maxW);
  }

  for (const block of blocks) {
    ctx.fillStyle = "#111111";
    ctx.font = `600 ${PNG_DAY_SIZE}px system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(block.dayTitle, contentLeft, y + PNG_DAY_SIZE / 2);
    y += PNG_DAY_SIZE + 6;
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(contentLeft, y);
    ctx.lineTo(contentLeft + contentWidth, y);
    ctx.stroke();
    y += 4;

    if (block.kind === "empty") {
      drawCell(block.message, contentLeft, y, contentWidth, {
        center: true,
        muted: true,
      });
      y += PNG_ROW_H + 18;
      continue;
    }

    let x = contentLeft;
    block.headers.forEach((header, i) => {
      drawCell(header, x, y, colWidths[i]!, {
        header: true,
        center: i > 0,
      });
      x += colWidths[i]!;
    });
    y += PNG_ROW_H;

    for (const row of block.rows) {
      x = contentLeft;
      row.forEach((cell, i) => {
        drawCell(cell, x, y, colWidths[i]!, { center: i > 0 });
        x += colWidths[i]!;
      });
      y += PNG_ROW_H;
    }
    y += 18;
  }

  return canvas;
}

/**
 * Render the week table to a PNG via canvas (no SVG/foreignObject — works on phones)
 * and share/download it. Keep this free of awaits before share/download so the
 * browser still treats it as a user gesture (required on mobile PWAs).
 */
export async function downloadScheduleWeekPng(
  args: ScheduleWeekPrintArgs,
): Promise<SchedulePngDeliverResult> {
  if (typeof document === "undefined") return "failed";

  try {
    const canvas = drawScheduleWeekPng(args);
    const blob = canvasToPngBlobSync(canvas);
    return deliverPngBlob(blob, uniquePngFilename(args.weekStart));
  } catch {
    return "failed";
  }
}
