#!/usr/bin/env node
// image-pipeline-worker.mjs
// 图片流水线独立进程 — 由 auto-gen.ts 的 spawnImagePipeline() 以 detached 方式启动。
// 在独立进程里运行，OOM 只会杀死本进程，Web 服务进程不受影响。
//
// Usage: node scripts/image-pipeline-worker.mjs <data-json-file>
//   data-json-file: { weekStart: "YYYY-MM-DD", days: DayInput[] }

import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execp = promisify(exec);

// ---------------------------------------------------------------------------
// 读取入参
// ---------------------------------------------------------------------------
const dataFile = process.argv[2];
if (!dataFile) {
  console.error("[image-pipeline-worker] missing data file argument");
  process.exit(1);
}

let weekStart, days;
try {
  const raw = await readFile(dataFile, "utf8");
  ({ weekStart, days } = JSON.parse(raw));
  // 读完即删，防止残留文件堆积
  await unlink(dataFile).catch(() => {});
} catch (e) {
  console.error("[image-pipeline-worker] failed to read data file:", e.message);
  process.exit(1);
}

const BASE_URL = process.env.AI_BASE_URL;
const API_KEY = process.env.AI_API_KEY;
const MODEL = process.env.AI_MODEL_IMAGE ?? "gpt-image-2";
const CWD = process.cwd();
const DATA_DIR = join(CWD, "family-menu-data");
const DISH_DIR = join(DATA_DIR, "dish-images");
const TABLE_DIR = join(DATA_DIR, "table-photos");
const BOARD_DIR = join(DATA_DIR, "menu-boards");

const t0 = Date.now();
console.log(`[image-pipeline-worker] PID=${process.pid} weekStart=${weekStart}`);

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------
async function fetchImage(url) {
  const r = await fetch(url);
  return Buffer.from(await r.arrayBuffer());
}

async function genImageFromAPI(prompt, size) {
  if (!BASE_URL || !API_KEY) return { ok: false, reason: "AI env missing" };
  const res = await fetch(`${BASE_URL}/v1/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt, n: 1, size }),
  });
  if (!res.ok) {
    return { ok: false, reason: `${res.status} ${(await res.text()).slice(0, 150)}` };
  }
  const data = await res.json();
  const item = data.data?.[0];
  if (!item) return { ok: false, reason: "no item in response" };
  let buf;
  if (item.b64_json) {
    buf = Buffer.from(item.b64_json, "base64");
  } else if (item.url?.startsWith("data:")) {
    buf = Buffer.from(item.url.split(",")[1], "base64");
  } else if (item.url) {
    buf = await fetchImage(item.url);
  } else {
    return { ok: false, reason: "no image data in response" };
  }
  return { ok: true, buf };
}

async function runBatched(items, parallel, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += parallel) {
    const batch = items.slice(i, i + parallel);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

// ---------------------------------------------------------------------------
// 1. 菜品图 (PARALLEL=5)
// ---------------------------------------------------------------------------
const SLOTS = ["主荤", "副荤", "蔬菜", "凉菜", "汤"];
const DISH_PARALLEL = 5;

async function genDishPhoto(dish) {
  const prompt = `Top-down professional food photography of one Chinese home dish: ${dish.name}.
Key ingredients visible: ${dish.ingredients}
Plating: single white porcelain bowl or oval plate, centered on the canvas, light wood or matte concrete surface beneath. Soft, diffused natural daylight from above. Shallow depth of field, sharp focus on the food.
Style: clean, magazine quality, MUJI / Kinfolk aesthetic. Photoreal, NOT illustration. Square 1:1 framing, plenty of breathing room around the plate.
NO text, NO chopsticks visible, NO watermark.`;
  const t = Date.now();
  try {
    const r = await genImageFromAPI(prompt, "1024x1024");
    if (!r.ok) {
      console.log(`[dish] ✗ ${dish.name} — ${r.reason}`);
      return false;
    }
    const outPath = join(DISH_DIR, dish.filename);
    await writeFile(outPath, r.buf);
    console.log(`[dish] ✓ ${dish.name} · ${(r.buf.length / 1024).toFixed(0)}KB · ${((Date.now() - t) / 1000).toFixed(1)}s`);
    return true;
  } catch (e) {
    console.log(`[dish] ✗ ${dish.name} — ${e.message}`);
    return false;
  }
}

await mkdir(DISH_DIR, { recursive: true });

const dishList = days.flatMap((day, di) =>
  day.dishes.flatMap((dish, si) =>
    dish.name?.trim()
      ? [{ dayIdx: di, slotIdx: si, name: dish.name.trim(), ingredients: dish.ingredients?.trim() ?? "", filename: `d${di + 1}-s${si}.png` }]
      : [],
  ),
);

console.log(`[image-pipeline-worker] generating ${dishList.length} dish photos (parallel=${DISH_PARALLEL})`);
const dishResults = await runBatched(dishList, DISH_PARALLEL, genDishPhoto);
const dishOk = dishResults.filter(Boolean).length;
console.log(`[image-pipeline-worker] dish photos · ${dishOk}/${dishList.length} ok · ${((Date.now() - t0) / 1000).toFixed(0)}s`);

// ---------------------------------------------------------------------------
// 2. 餐桌图 (PARALLEL=3)
// ---------------------------------------------------------------------------
const TABLE_PARALLEL = 3;

async function genTablePhoto(day) {
  const dishes = day.dishes.filter((d) => d.name?.trim()).map((d) => d.name.trim());
  if (dishes.length === 0) return false;
  const prompt = `Top-down overhead photograph of a complete Chinese family dinner table laid out for sharing.

The table has ${dishes.length} home-cooked dishes plated on white porcelain bowls and oval plates: ${dishes.join(" / ")}.

Composition: dishes arranged in a balanced minimalist layout on a light wood (or matte concrete) tabletop, with small pairs of natural-wood chopsticks resting beside the plates, a small celadon teacup at the corner. Generous breathing room between plates.

Lighting: soft, diffused natural daylight from a side window, gentle shadows, no harsh highlights.

Style: editorial food photography, MUJI / Kinfolk aesthetic, photoreal, NOT illustration. Square 1:1 framing. Color palette is calm and muted — primarily warm whites, light woods, with the natural colors of the food itself.

NO text labels, NO watermark, NO people, NO additional decorative props beyond the chopsticks and teacup.`;
  const t = Date.now();
  try {
    const r = await genImageFromAPI(prompt, "1536x1024");
    if (!r.ok) {
      console.log(`[table] ✗ ${day.date} — ${r.reason}`);
      return false;
    }
    const outPath = join(TABLE_DIR, `${day.date}.png`);
    await writeFile(outPath, r.buf);
    console.log(`[table] ✓ ${day.date} · ${(r.buf.length / 1024).toFixed(0)}KB · ${((Date.now() - t) / 1000).toFixed(1)}s`);
    return true;
  } catch (e) {
    console.log(`[table] ✗ ${day.date} — ${e.message}`);
    return false;
  }
}

await mkdir(TABLE_DIR, { recursive: true });

const daysWithDishes = days.filter((d) => d.dishes.some((dish) => dish.name?.trim()));
console.log(`[image-pipeline-worker] generating ${daysWithDishes.length} table photos (parallel=${TABLE_PARALLEL})`);
const tableResults = await runBatched(daysWithDishes, TABLE_PARALLEL, genTablePhoto);
const tableOk = tableResults.filter(Boolean).length;
console.log(`[image-pipeline-worker] table photos · ${tableOk}/${daysWithDishes.length} ok · ${((Date.now() - t0) / 1000).toFixed(0)}s`);

// ---------------------------------------------------------------------------
// 3. 菜单海报 (Chrome headless — 在独立进程里跑，OOM 只杀本进程)
// ---------------------------------------------------------------------------
if (dishOk === 0) {
  console.warn("[image-pipeline-worker] no dish photos — skipping menu board");
  process.exit(0);
}

await mkdir(BOARD_DIR, { recursive: true });

const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周日"];

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const start = days[0].date.slice(5).replace("-", ".");
const end = days[days.length - 1].date.slice(5).replace("-", ".");

const rows = days.map((d, di) => ({
  weekday: WEEKDAYS[di] ?? `日${di + 1}`,
  date: d.date.slice(5).replace("-", "."),
  cells: d.dishes.map((dish, dishi) => ({
    slot: SLOTS[dishi] ?? "",
    name: dish.name?.trim() || "（未填）",
    img: `file://${join(DISH_DIR, `d${di + 1}-s${dishi}.png`)}`,
  })),
}));

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>本周菜单</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; background: #FAFAF7; color: #2C2C2C; -webkit-font-smoothing: antialiased; }
  body { width: 1024px; padding: 56px 48px 48px; }
  .title-row { display: flex; align-items: baseline; justify-content: space-between; border-bottom: 1px solid #E0DCD2; padding-bottom: 16px; margin-bottom: 36px; }
  .title { font-size: 22px; font-weight: 500; letter-spacing: 0.02em; }
  .title .sep { color: #999; margin: 0 10px; font-weight: 300; }
  .title .date { color: #5A7A4A; font-weight: 500; }
  .meta { font-size: 12px; color: #999; letter-spacing: 0.05em; }
  .row { display: grid; grid-template-columns: 64px repeat(5, 1fr); gap: 16px; align-items: center; padding: 14px 0; border-bottom: 1px solid #F0EEE7; }
  .row:last-child { border-bottom: none; }
  .day { color: #999; font-size: 14px; letter-spacing: 0.05em; }
  .day-label { color: #2C2C2C; font-weight: 500; display: block; margin-bottom: 4px; }
  .cell { display: flex; flex-direction: column; align-items: center; }
  .cell img { width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 8px; background: #EEE; }
  .cell .name { margin-top: 8px; font-size: 12px; color: #2C2C2C; text-align: center; line-height: 1.4; letter-spacing: 0.02em; }
  .cell .slot { font-size: 10px; color: #B5B0A6; margin-top: 2px; letter-spacing: 0.1em; }
  .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #B5B0A6; letter-spacing: 0.15em; }
</style>
</head>
<body>
  <div class="title-row">
    <div class="title">本周菜单 <span class="sep">/</span> <span class="date">${start} — ${end}</span></div>
    <div class="meta">FAMILY · MENU · WEEKLY</div>
  </div>
  ${rows.map((row) => `
    <div class="row">
      <div class="day"><span class="day-label">${escapeHtml(row.weekday)}</span><span>${escapeHtml(row.date)}</span></div>
      ${row.cells.map((cell) => `
        <div class="cell">
          <img src="${cell.img}" alt="${escapeHtml(cell.name)}" />
          <div class="name">${escapeHtml(cell.name)}</div>
          <div class="slot">${escapeHtml(cell.slot)}</div>
        </div>`).join("")}
    </div>`).join("")}
  <div class="footer">SUZHOU · BENBANG · 一菜一饭皆是温情</div>
</body>
</html>`;

const htmlPath = `/tmp/menu-board-${weekStart}.html`;
const pngPath = join(BOARD_DIR, `${weekStart}_week.png`);
await writeFile(htmlPath, html, "utf8");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const cmd = `"${CHROME}" --headless=new --disable-gpu --hide-scrollbars --window-size=1024,1900 --virtual-time-budget=8000 --screenshot="${pngPath}" "file://${htmlPath}"`;

try {
  // timeout=120s — Chrome in this child process; if it OOMs, only this worker dies
  await execp(cmd, { maxBuffer: 8 * 1024 * 1024, timeout: 120_000 });
  console.log(`[image-pipeline-worker] menu board → ${pngPath}`);
} catch (e) {
  console.error(`[image-pipeline-worker] menu board failed: ${e.message}`);
}

const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
console.log(`[image-pipeline-worker] done · ${elapsed}s · dish=${dishOk}/${dishList.length} table=${tableOk}/${daysWithDishes.length}`);
