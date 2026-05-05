// Compose 30 generated dish photos into a clean grid menu poster with REAL Chinese text labels.
// Output: ~/Documents/family-menu-data/menu-boards/2026-05-04_week_real.png
//
// Usage: node --env-file=.env.local scripts/compose-menu-board.mjs

import { exec } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import pg from "pg";

const execp = promisify(exec);
const HOME = homedir();
const IMG_DIR = join(HOME, "Documents/family-menu-data/dish-images");
const OUT_DIR = join(HOME, "Documents/family-menu-data/menu-boards");
const HTML_PATH = "/tmp/menu-board.html";
const PNG_PATH = join(OUT_DIR, "2026-05-04_week_real.png");

await mkdir(OUT_DIR, { recursive: true });

const c = new pg.Client({
  host: process.env.SUPABASE_DB_HOST,
  port: 5432,
  database: "postgres",
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const r = await c.query(
  "select week_start::text, days from weekly_menus where week_start = $1",
  ["2026-05-04"],
);
await c.end();
if (r.rows.length === 0) {
  console.error("no menu");
  process.exit(1);
}

const days = r.rows[0].days;
const SLOTS = ["主荤", "副荤", "蔬菜", "凉菜", "汤"];
const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六"];

const rows = days.map((d, di) => {
  const date = d.date.slice(5).replace("-", ".");
  return {
    weekday: WEEKDAYS[di],
    date,
    cells: d.dishes.map((dish, dishi) => ({
      slot: SLOTS[dishi],
      name: dish.name,
      img: `file://${join(IMG_DIR, `d${di + 1}-s${dishi}.png`)}`,
    })),
  };
});

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>本周菜单</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
    background: #FAFAF7;
    color: #2C2C2C;
    -webkit-font-smoothing: antialiased;
  }
  body {
    width: 1024px;
    padding: 56px 48px 48px;
  }
  .title-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    border-bottom: 1px solid #E0DCD2;
    padding-bottom: 16px;
    margin-bottom: 36px;
  }
  .title {
    font-size: 22px;
    font-weight: 500;
    letter-spacing: 0.02em;
  }
  .title .sep {
    color: #999;
    margin: 0 10px;
    font-weight: 300;
  }
  .title .date {
    color: #5A7A4A;
    font-weight: 500;
  }
  .meta {
    font-size: 12px;
    color: #999;
    letter-spacing: 0.05em;
  }
  .row {
    display: grid;
    grid-template-columns: 64px repeat(5, 1fr);
    gap: 16px;
    align-items: center;
    padding: 14px 0;
    border-bottom: 1px solid #F0EEE7;
  }
  .row:last-child { border-bottom: none; }
  .day {
    color: #999;
    font-size: 14px;
    letter-spacing: 0.05em;
  }
  .day-label { color: #2C2C2C; font-weight: 500; display: block; margin-bottom: 4px; }
  .cell {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .cell img {
    width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
    border-radius: 8px;
    background: #EEE;
  }
  .cell .name {
    margin-top: 8px;
    font-size: 12px;
    color: #2C2C2C;
    text-align: center;
    line-height: 1.4;
    letter-spacing: 0.02em;
  }
  .cell .slot {
    font-size: 10px;
    color: #B5B0A6;
    margin-top: 2px;
    letter-spacing: 0.1em;
  }
  .footer {
    margin-top: 32px;
    text-align: center;
    font-size: 11px;
    color: #B5B0A6;
    letter-spacing: 0.15em;
  }
</style>
</head>
<body>
  <div class="title-row">
    <div class="title">本周菜单 <span class="sep">/</span> <span class="date">5.4 — 5.9</span></div>
    <div class="meta">FAMILY · MENU · WEEKLY</div>
  </div>
  ${rows.map((row) => `
    <div class="row">
      <div class="day">
        <span class="day-label">${row.weekday}</span>
        <span>${row.date}</span>
      </div>
      ${row.cells.map((c) => `
        <div class="cell">
          <img src="${c.img}" alt="${c.name}" />
          <div class="name">${c.name}</div>
          <div class="slot">${c.slot.toUpperCase ? c.slot : c.slot}</div>
        </div>
      `).join("")}
    </div>
  `).join("")}
  <div class="footer">SUZHOU · BENBANG · 一菜一饭皆是温情</div>
</body>
</html>`;

await writeFile(HTML_PATH, html, "utf8");
console.log(`✓ HTML written → ${HTML_PATH}`);

// Render via headless Chrome
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const cmd = `"${CHROME}" --headless=new --disable-gpu --hide-scrollbars --window-size=1024,1900 --virtual-time-budget=8000 --screenshot="${PNG_PATH}" "file://${HTML_PATH}"`;
console.log(`→ rendering via headless Chrome…`);
await execp(cmd, { maxBuffer: 64 * 1024 * 1024 });
console.log(`✓ PNG saved → ${PNG_PATH}`);
