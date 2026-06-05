import "server-only";
import { exec } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { WEEKDAYS, type DayInput } from "@/lib/shared";

const execp = promisify(exec);
const HOME = homedir();
const IMG_DIR = join(HOME, "Documents/family-menu-data/dish-images");
const OUT_DIR = join(HOME, "Documents/family-menu-data/menu-boards");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export const MENU_BOARDS_DIR = OUT_DIR;

const SLOTS = ["主荤", "副荤", "蔬菜", "凉菜", "汤"] as const;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function composeMenuBoard(opts: {
  weekStart: string;
  days: DayInput[];
}): Promise<string> {
  await mkdir(OUT_DIR, { recursive: true });

  const start = opts.days[0].date.slice(5).replace("-", ".");
  const end = opts.days[opts.days.length - 1].date.slice(5).replace("-", ".");

  const rows = opts.days.map((d, di) => ({
    weekday: WEEKDAYS[di] ?? `日${di + 1}`,
    date: d.date.slice(5).replace("-", "."),
    cells: d.dishes.map((dish, dishi) => ({
      slot: SLOTS[dishi] ?? "",
      name: dish.name?.trim() || "（未填）",
      img: `file://${join(IMG_DIR, `d${di + 1}-s${dishi}.png`)}`,
    })),
  }));

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
  body { width: 1024px; padding: 56px 48px 48px; }
  .title-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    border-bottom: 1px solid #E0DCD2;
    padding-bottom: 16px;
    margin-bottom: 36px;
  }
  .title { font-size: 22px; font-weight: 500; letter-spacing: 0.02em; }
  .title .sep { color: #999; margin: 0 10px; font-weight: 300; }
  .title .date { color: #5A7A4A; font-weight: 500; }
  .meta { font-size: 12px; color: #999; letter-spacing: 0.05em; }
  .row {
    display: grid;
    grid-template-columns: 64px repeat(5, 1fr);
    gap: 16px;
    align-items: center;
    padding: 14px 0;
    border-bottom: 1px solid #F0EEE7;
  }
  .row:last-child { border-bottom: none; }
  .day { color: #999; font-size: 14px; letter-spacing: 0.05em; }
  .day-label { color: #2C2C2C; font-weight: 500; display: block; margin-bottom: 4px; }
  .cell { display: flex; flex-direction: column; align-items: center; }
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
    <div class="title">本周菜单 <span class="sep">/</span> <span class="date">${start} — ${end}</span></div>
    <div class="meta">FAMILY · MENU · WEEKLY</div>
  </div>
  ${rows
    .map(
      (row) => `
    <div class="row">
      <div class="day">
        <span class="day-label">${escapeHtml(row.weekday)}</span>
        <span>${escapeHtml(row.date)}</span>
      </div>
      ${row.cells
        .map(
          (cell) => `
        <div class="cell">
          <img src="${cell.img}" alt="${escapeHtml(cell.name)}" />
          <div class="name">${escapeHtml(cell.name)}</div>
          <div class="slot">${escapeHtml(cell.slot)}</div>
        </div>
      `,
        )
        .join("")}
    </div>
  `,
    )
    .join("")}
  <div class="footer">SUZHOU · BENBANG · 一菜一饭皆是温情</div>
</body>
</html>`;

  const htmlPath = `/tmp/menu-board-${opts.weekStart}.html`;
  const pngPath = join(OUT_DIR, `${opts.weekStart}_week_real.png`);
  await writeFile(htmlPath, html, "utf8");
  const cmd = `"${CHROME}" --headless=new --disable-gpu --hide-scrollbars --window-size=1024,1900 --virtual-time-budget=8000 --screenshot="${pngPath}" "file://${htmlPath}"`;
  await execp(cmd, { maxBuffer: 64 * 1024 * 1024 });
  return pngPath;
}
