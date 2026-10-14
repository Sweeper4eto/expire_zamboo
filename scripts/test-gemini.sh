#!/usr/bin/env bash
set -euo pipefail
cd /var/www/magazin

node --input-type=module <<'EOF'
import "dotenv/config";

const key = process.env.GEMINI_API_KEY?.trim() || "";
let preferred = process.env.DOCUMENT_AI_MODEL?.trim() || "gemini-3.6-flash";
if (!key) {
  console.error("FAIL: GEMINI_API_KEY is empty in .env");
  process.exit(1);
}
if (/\s/.test(preferred)) {
  console.warn(`WARN: DOCUMENT_AI_MODEL has spaces ('${preferred}') — using gemini-3.6-flash`);
  preferred = "gemini-3.6-flash";
}

const models = [
  preferred,
  "gemini-3.6-flash",
  "gemini-3.8-flash",
  "gemini-3-flash-preview",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
].filter((model, index, all) => all.indexOf(model) === index);

console.log(`Key length: ${key.length}`);
console.log(`Trying models: ${models.join(", ")}`);

let okModel = null;
for (const model of models) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "Reply with exactly: ok" }] }],
    }),
  });
  const text = await res.text();
  console.log(`\n${model} -> HTTP ${res.status}`);
  console.log(text.slice(0, 240));
  if (res.ok) {
    okModel = model;
    break;
  }
}

if (!okModel) {
  console.error("\nFAIL: no working Gemini model for this key");
  process.exit(1);
}

console.log(`\nOK: use DOCUMENT_AI_MODEL=${okModel}`);
process.exit(0);
EOF
