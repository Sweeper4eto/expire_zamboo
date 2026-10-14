/**
 * Builds a standalone HTML preview — open in browser without a server.
 * Run: node scripts/build-no-picture-preview-html.mjs
 */
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const items = [
  { n: 1, title: "Milk carton", desc: "Fresh dairy", svg: `<path d="M22 14h20l4 8v30H18V22l4-8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M26 14V10h12v4" stroke="currentColor" stroke-width="2"/><path d="M24 28h16M24 34h12" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>` },
  { n: 2, title: "Bread loaf", desc: "Bakery", svg: `<path d="M14 38c0-12 8-18 18-18s18 6 18 18v8H14v-8z" stroke="currentColor" stroke-width="2"/><path d="M20 30c4-6 10-8 12-8s8 2 12 8" stroke="currentColor" stroke-width="1.5" opacity="0.4"/><path d="M18 46h28" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>` },
  { n: 3, title: "Apple", desc: "Produce", svg: `<circle cx="32" cy="36" r="14" stroke="currentColor" stroke-width="2"/><path d="M32 22c2-4 6-6 8-6M32 22v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M38 18c2 1 3 3 3 5" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>` },
  { n: 4, title: "Egg carton", desc: "Chilled", svg: `<path d="M14 30h36v16H14V30z" stroke="currentColor" stroke-width="2"/><ellipse cx="22" cy="38" rx="4" ry="5" stroke="currentColor" stroke-width="1.5"/><ellipse cx="32" cy="38" rx="4" ry="5" stroke="currentColor" stroke-width="1.5"/><ellipse cx="42" cy="38" rx="4" ry="5" stroke="currentColor" stroke-width="1.5"/>` },
  { n: 5, title: "Cheese wedge", desc: "Deli / dairy", svg: `<path d="M16 44L32 18l16 26H16z" stroke="currentColor" stroke-width="2"/><circle cx="26" cy="34" r="2" fill="currentColor" opacity="0.35"/><circle cx="34" cy="30" r="2" fill="currentColor" opacity="0.35"/><circle cx="38" cy="38" r="2" fill="currentColor" opacity="0.35"/>` },
  { n: 6, title: "Yogurt cup", desc: "Refrigerated", svg: `<path d="M22 20h20l-2 28H24L22 20z" stroke="currentColor" stroke-width="2"/><path d="M20 20h24" stroke="currentColor" stroke-width="2"/><path d="M26 30h12" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>` },
  { n: 7, title: "Cereal box", desc: "Dry goods", svg: `<rect x="18" y="14" width="28" height="38" rx="2" stroke="currentColor" stroke-width="2"/><rect x="22" y="20" width="20" height="12" rx="1" stroke="currentColor" stroke-width="1.5" opacity="0.45"/><path d="M22 38h20M22 44h14" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>` },
  { n: 8, title: "Chips bag", desc: "Snacks", svg: `<path d="M24 12h16l6 40H18l6-40z" stroke="currentColor" stroke-width="2"/><path d="M22 22h20M24 32h16" stroke="currentColor" stroke-width="1.5" opacity="0.4"/><circle cx="32" cy="28" r="4" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>` },
  { n: 9, title: "Water bottle", desc: "Beverages", svg: `<rect x="24" y="10" width="16" height="6" rx="2" stroke="currentColor" stroke-width="2"/><path d="M22 16h20v34c0 2-2 4-4 4h-12c-2 0-4-2-4-4V16z" stroke="currentColor" stroke-width="2"/><path d="M24 28h16" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>` },
  { n: 10, title: "Wine bottle", desc: "Bottles", svg: `<path d="M28 10h8v8c0 4 8 8 8 16v18H20V34c0-8 8-12 8-16v-8z" stroke="currentColor" stroke-width="2"/><path d="M22 40h20" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>` },
  { n: 11, title: "Frozen pizza", desc: "Freezer", svg: `<rect x="12" y="20" width="40" height="28" rx="2" stroke="currentColor" stroke-width="2"/><circle cx="32" cy="34" r="10" stroke="currentColor" stroke-width="1.5" opacity="0.45"/><path d="M32 24v20M22 34h20" stroke="currentColor" stroke-width="1.25" opacity="0.3"/>` },
  { n: 12, title: "Ice cream", desc: "Frozen dessert", svg: `<path d="M32 12c6 8 10 14 10 20a10 10 0 11-20 0c0-6 4-12 10-20z" stroke="currentColor" stroke-width="2"/><path d="M24 44l8 10 8-10" stroke="currentColor" stroke-width="2"/>` },
  { n: 13, title: "Meat steak", desc: "Butcher", svg: `<path d="M16 36c0-10 8-16 16-16s16 6 16 16" stroke="currentColor" stroke-width="2"/><ellipse cx="32" cy="36" rx="16" ry="10" stroke="currentColor" stroke-width="2"/><path d="M24 34c2 2 6 3 8 3s6-1 8-3" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>` },
  { n: 14, title: "Fish", desc: "Seafood", svg: `<path d="M12 32c8-8 20-10 32-4l-6 4 6 4c-12 6-24 4-32-4z" stroke="currentColor" stroke-width="2"/><circle cx="38" cy="28" r="2" fill="currentColor" opacity="0.5"/>` },
  { n: 15, title: "Carrot bundle", desc: "Vegetables", svg: `<path d="M28 18c-2 8-2 16 0 28M32 16c0 12 0 22 2 30M36 18c2 8 2 16 0 28" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M26 16c2-4 6-6 10-6M30 14c0-4 4-6 8-4" stroke="currentColor" stroke-width="1.5" opacity="0.45"/>` },
  { n: 16, title: "Bananas", desc: "Fruit", svg: `<path d="M20 44c8-20 16-26 24-22M24 46c6-14 12-20 20-18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M40 20c2 2 2 6 0 8" stroke="currentColor" stroke-width="1.5" opacity="0.45"/>` },
  { n: 17, title: "Tomato", desc: "Produce", svg: `<circle cx="32" cy="36" r="13" stroke="currentColor" stroke-width="2"/><path d="M26 22l6-4 6 4M32 18v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>` },
  { n: 18, title: "Pasta pack", desc: "Dry groceries", svg: `<rect x="18" y="16" width="28" height="34" rx="3" stroke="currentColor" stroke-width="2"/><path d="M22 26c4 4 8 4 12 0s8-4 12 0M22 34c4 4 8 4 12 0s8-4 12 0" stroke="currentColor" stroke-width="1.5" opacity="0.45"/>` },
  { n: 19, title: "Rice bag", desc: "Bulk dry", svg: `<path d="M20 18c4-4 20-4 24 0v30c-4 4-20 4-24 0V18z" stroke="currentColor" stroke-width="2"/><path d="M24 28h16M24 36h12" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>` },
  { n: 20, title: "Honey jar", desc: "Spreads", svg: `<path d="M20 26h24v22c0 2-2 4-4 4H24c-2 0-4-2-4-4V26z" stroke="currentColor" stroke-width="2"/><path d="M22 26c0-6 6-10 10-10s10 4 10 10" stroke="currentColor" stroke-width="2"/><path d="M24 36h16" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>` },
  { n: 21, title: "Shopping basket", desc: "Mixed items", svg: `<path d="M16 26h32l-4 22H20l-4-22z" stroke="currentColor" stroke-width="2"/><path d="M22 18c0 4 20 4 20 0" stroke="currentColor" stroke-width="2"/><circle cx="24" cy="34" r="3" stroke="currentColor" stroke-width="1.25"/><rect x="30" y="31" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.25"/><path d="M38 33h4v4h-4" stroke="currentColor" stroke-width="1.25"/>` },
  { n: 22, title: "Produce basket", desc: "Market", svg: `<path d="M14 30c4-8 32-8 36 0v16c-4 6-32 6-36 0V30z" stroke="currentColor" stroke-width="2"/><circle cx="24" cy="34" r="4" stroke="currentColor" stroke-width="1.25"/><path d="M34 30c0 4 2 8 6 8M40 32l4-6" stroke="currentColor" stroke-width="1.25"/>` },
  { n: 23, title: "Deli pack", desc: "Ready meals", svg: `<rect x="14" y="24" width="36" height="22" rx="3" stroke="currentColor" stroke-width="2"/><path d="M14 32h36" stroke="currentColor" stroke-width="1.5" opacity="0.35"/><rect x="20" y="28" width="10" height="8" rx="1" stroke="currentColor" stroke-width="1.25"/><rect x="34" y="28" width="10" height="8" rx="1" stroke="currentColor" stroke-width="1.25"/>` },
  { n: 24, title: "Croissant", desc: "Bakery", svg: `<path d="M16 38c4-14 12-20 20-18s12 8 12 18" stroke="currentColor" stroke-width="2"/><path d="M20 36c4-6 8-8 12-8s8 2 12 8" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>` },
  { n: 25, title: "Mixed grocery bag", desc: "Varied stock", svg: `<path d="M18 24h28l5 24H13l5-24z" stroke="currentColor" stroke-width="2"/><path d="M22 18c0 4 20 4 20 0" stroke="currentColor" stroke-width="2"/><rect x="22" y="30" width="8" height="10" rx="1" stroke="currentColor" stroke-width="1.25"/><circle cx="38" cy="34" r="4" stroke="currentColor" stroke-width="1.25"/><path d="M30 38h8" stroke="currentColor" stroke-width="1.25"/>` },
  { n: 26, title: "Warehouse shelf", desc: "Backroom stock", svg: `<path d="M10 24h44M10 38h44M10 52h44" stroke="currentColor" stroke-width="2"/><rect x="14" y="14" width="10" height="8" rx="1" stroke="currentColor" stroke-width="1.25"/><rect x="28" y="28" width="12" height="8" rx="1" stroke="currentColor" stroke-width="1.25"/><rect x="42" y="42" width="10" height="8" rx="1" stroke="currentColor" stroke-width="1.25"/>` },
  { n: 27, title: "Fresh salad", desc: "Prepared food", svg: `<ellipse cx="32" cy="38" rx="18" ry="10" stroke="currentColor" stroke-width="2"/><path d="M20 34c4-8 8-12 12-12s8 4 12 12" stroke="currentColor" stroke-width="1.5" opacity="0.45"/><path d="M24 30l4 6M32 28l2 8M40 30l-4 6" stroke="currentColor" stroke-width="1.25"/>` },
  { n: 28, title: "Orange juice", desc: "Juice carton", svg: `<rect x="20" y="18" width="24" height="32" rx="3" stroke="currentColor" stroke-width="2"/><circle cx="32" cy="30" r="6" stroke="currentColor" stroke-width="1.5" opacity="0.45"/><path d="M28 30h8M32 26v8" stroke="currentColor" stroke-width="1.25" opacity="0.35"/>` },
  { n: 29, title: "Mini market scene", desc: "Multiple goods", svg: `<path d="M12 46h40" stroke="currentColor" stroke-width="2"/><rect x="16" y="28" width="10" height="18" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="28" y="24" width="8" height="22" rx="1" stroke="currentColor" stroke-width="1.5"/><circle cx="44" cy="36" r="5" stroke="currentColor" stroke-width="1.5"/><path d="M20 20h24l-4 8H24l-4-8z" stroke="currentColor" stroke-width="1.5"/>` },
  { n: 30, title: "Gift hamper", desc: "Bundled goods", svg: `<rect x="14" y="26" width="36" height="22" rx="2" stroke="currentColor" stroke-width="2"/><path d="M32 26V16M22 20c0-4 4-6 10-4M42 20c0-4-4-6-10-4M32 16v10" stroke="currentColor" stroke-width="2"/>` },
];

const cards = items
  .map(
    (item) => `
    <article class="card" data-n="${item.n}" tabindex="0">
      <div class="num">${item.n}</div>
      <div class="thumb">
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">${item.svg}</svg>
      </div>
      <h2>${item.n}. ${item.title}</h2>
      <p>${item.desc}</p>
    </article>`,
  )
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Magazin — 30 no-picture options</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, Segoe UI, sans-serif;
      background: #09090b;
      color: #fafafa;
      padding: 24px 16px 48px;
    }
    h1 { margin: 0 0 8px; font-size: 1.5rem; }
    .sub { color: #a1a1aa; max-width: 640px; line-height: 1.5; margin-bottom: 8px; }
    .pick {
      display: none;
      margin: 16px 0 24px;
      padding: 12px 16px;
      border: 1px solid rgba(52,211,153,.4);
      background: rgba(52,211,153,.1);
      border-radius: 12px;
      color: #6ee7b7;
    }
    .pick.show { display: block; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 16px;
      max-width: 1100px;
    }
    .card {
      border: 1px solid #3f3f46;
      border-radius: 16px;
      padding: 12px;
      cursor: pointer;
      transition: border-color .15s, background .15s;
      position: relative;
    }
    .card:hover { border-color: #71717a; }
    .card.selected {
      border-color: #34d399;
      background: rgba(52,211,153,.08);
      box-shadow: 0 0 0 1px rgba(52,211,153,.35);
    }
    .num {
      position: absolute;
      top: 10px;
      right: 10px;
      font-size: 11px;
      font-weight: 700;
      color: #34d399;
      background: rgba(52,211,153,.15);
      width: 24px;
      height: 24px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .thumb {
      width: 100%;
      aspect-ratio: 1;
      border: 1px solid #3f3f46;
      border-radius: 12px;
      background: rgba(9,9,11,.55);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18%;
      color: #a1a1aa;
      margin-bottom: 10px;
    }
    .card.selected .thumb { color: #6ee7b7; border-color: rgba(52,211,153,.35); }
    .thumb svg { width: 100%; height: 100%; }
    .card h2 { margin: 0 0 4px; font-size: 13px; font-weight: 600; }
    .card p { margin: 0; font-size: 11px; color: #a1a1aa; line-height: 1.35; }
    .current {
      max-width: 1100px;
      margin-bottom: 28px;
      padding: 16px;
      border: 1px solid #3f3f46;
      border-radius: 16px;
    }
    .current-label { font-size: 12px; color: #a1a1aa; margin-bottom: 10px; }
    .current-box {
      width: 80px;
      height: 80px;
      border: 1px solid #3f3f46;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-size: 10px;
      color: #a1a1aa;
      padding: 6px;
    }
  </style>
</head>
<body>
  <h1>30 goods placeholders — pick 1–30</h1>
  <p class="sub">Preview only. Open this file directly in your browser — no server needed. Click a card, then tell me the number in chat.</p>
  <p id="pick" class="pick"></p>

  <section class="current">
    <div class="current-label">Current app (unchanged)</div>
    <div class="current-box">No picture</div>
  </section>

  <div class="grid">${cards}</div>

  <script>
    const pick = document.getElementById("pick");
    document.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("click", () => {
        document.querySelectorAll(".card").forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        const n = card.dataset.n;
        const title = card.querySelector("h2").textContent;
        pick.textContent = "Selected: " + title + " — reply in chat with: implement " + n;
        pick.classList.add("show");
      });
    });
  </script>
</body>
</html>`;

const outDir = path.join(process.cwd(), "design-preview");
const outFile = path.join(outDir, "no-picture-options.html");
await mkdir(outDir, { recursive: true });
await writeFile(outFile, html, "utf8");
console.log("Written:", outFile);
