import "server-only";
import { exec } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execp = promisify(exec);
const HOME = homedir();
const DISH_IMG_DIR = join(HOME, "Documents/family-menu-data/dish-images");
const TABLE_PHOTOS = join(HOME, "Documents/family-menu-data/table-photos");
const OUT_DIR = join(HOME, "Documents/family-menu-data/day-boards");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export const DAY_BOARDS_DIR = OUT_DIR;

const DISH_ICONS = ["🍖", "🍳", "🥬", "🥗", "🍲"];
const DISH_SLOTS = ["主荤", "副荤", "蔬菜", "凉菜", "汤"];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function composeDayBoard(opts: {
  date: string; // YYYY-MM-DD
  weekdayLabel: string; // e.g. 周三
  dayIdx: number; // 0..5 — used to locate dish images
  dishes: { name: string; ingredients: string }[];
  hasTable: boolean;
}): Promise<string> {
  await mkdir(OUT_DIR, { recursive: true });

  const filledDishes = opts.dishes
    .map((d, i) => ({ ...d, idx: i }))
    .filter((d) => d.name?.trim());

  const dateLabel = `${Number(opts.date.slice(5, 7))}月${Number(opts.date.slice(8, 10))}日`;
  const tableImgPath = `file://${join(TABLE_PHOTOS, `${opts.date}.png`)}`;

  const dishCards = filledDishes
    .map((dish) => {
      const imgPath = `file://${join(DISH_IMG_DIR, `d${opts.dayIdx + 1}-s${dish.idx}.png`)}`;
      const slot = DISH_SLOTS[dish.idx] ?? "";
      const icon = DISH_ICONS[dish.idx] ?? "";
      return `
        <div class="dish">
          <img src="${imgPath}" alt="${escapeHtml(dish.name)}" />
          <div class="meta">
            <div class="slot">${escapeHtml(icon)} ${escapeHtml(slot)}</div>
            <div class="name">${escapeHtml(dish.name)}</div>
            ${
              dish.ingredients
                ? `<div class="ing">${escapeHtml(dish.ingredients)}</div>`
                : ""
            }
          </div>
        </div>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${dateLabel} 菜单</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
    background: #FAFAF7;
    color: #2C2C2C;
    -webkit-font-smoothing: antialiased;
  }
  body { width: 1024px; padding: 48px 48px 36px; }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    border-bottom: 1px solid #E0DCD2;
    padding-bottom: 14px;
    margin-bottom: 28px;
  }
  .title { font-size: 26px; font-weight: 500; letter-spacing: 0.02em; }
  .title .date { color: #5A7A4A; margin-left: 8px; font-weight: 600; }
  .meta-tag { font-size: 12px; color: #999; letter-spacing: 0.05em; }
  .table-photo {
    width: 100%;
    aspect-ratio: 3 / 2;
    object-fit: cover;
    border-radius: 12px;
    margin-bottom: 28px;
    background: #EEE;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }
  .dish {
    display: flex;
    gap: 12px;
    padding: 12px;
    border: 1px solid #E0DCD2;
    border-radius: 10px;
    background: #fff;
  }
  .dish img {
    width: 120px;
    height: 120px;
    object-fit: cover;
    border-radius: 8px;
    flex-shrink: 0;
    background: #EEE;
  }
  .meta { flex: 1; min-width: 0; }
  .slot { font-size: 11px; color: #B5B0A6; letter-spacing: 0.1em; margin-bottom: 4px; }
  .name { font-size: 16px; font-weight: 500; line-height: 1.4; margin-bottom: 6px; }
  .ing { font-size: 11.5px; color: #6F5C40; line-height: 1.55; }
  .footer {
    margin-top: 28px;
    text-align: center;
    font-size: 11px;
    color: #B5B0A6;
    letter-spacing: 0.15em;
  }
</style>
</head>
<body>
  <div class="head">
    <div class="title">${escapeHtml(opts.weekdayLabel)}<span class="date">${dateLabel}</span></div>
    <div class="meta-tag">家庭菜单 · ${filledDishes.length} 道菜</div>
  </div>
  ${opts.hasTable ? `<img src="${tableImgPath}" alt="餐桌摆盘" class="table-photo" />` : ""}
  <div class="grid">${dishCards}</div>
  <div class="footer">SUZHOU · BENBANG · 一菜一饭皆是温情</div>
</body>
</html>`;

  const htmlPath = `/tmp/day-board-${opts.date}.html`;
  const pngPath = join(OUT_DIR, `${opts.date}.png`);
  await writeFile(htmlPath, html, "utf8");
  const cmd = `"${CHROME}" --headless=new --disable-gpu --hide-scrollbars --window-size=1024,1500 --virtual-time-budget=8000 --screenshot="${pngPath}" "file://${htmlPath}"`;
  await execp(cmd, { maxBuffer: 64 * 1024 * 1024 });
  return pngPath;
}
