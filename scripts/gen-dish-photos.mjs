// Generate 30 individual food-photography images, one per dish.
// Saves to ~/Documents/family-menu-data/dish-images/{day}-{slot}-{slug}.png

import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import pg from "pg";

const baseURL = process.env.AI_BASE_URL;
const apiKey = process.env.AI_API_KEY;
const MODEL = process.argv[2] || "gpt-image-2";
const PARALLEL = 5;

const DEST = join(homedir(), "Documents/family-menu-data/dish-images");
await mkdir(DEST, { recursive: true });

// Pull current week's menu
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
  console.error("no menu for 2026-05-04");
  process.exit(1);
}

const SLOTS = ["主荤", "副荤", "蔬菜", "凉菜", "汤"];
const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六"];

const dishes = [];
r.rows[0].days.forEach((d, di) => {
  d.dishes.forEach((dish, dishi) => {
    if (!dish.name?.trim()) return;
    dishes.push({
      day: di + 1,
      dayLabel: WEEKDAYS[di],
      slotLabel: SLOTS[dishi],
      slot: dishi,
      name: dish.name.trim(),
      ingredients: dish.ingredients?.trim() ?? "",
      filename: `d${di + 1}-s${dishi}.png`,
    });
  });
});

console.log(`→ ${dishes.length} dishes; model=${MODEL}; parallel=${PARALLEL}`);

function buildPrompt(d) {
  return `Top-down professional food photography of one Chinese home dish: ${d.name}.
Key ingredients visible: ${d.ingredients}
Plating: single white porcelain bowl or oval plate, centered on the canvas, light wood or matte concrete surface beneath. Soft, diffused natural daylight from above. Shallow depth of field, sharp focus on the food.
Style: clean, magazine quality, MUJI / Kinfolk aesthetic. Photoreal, NOT illustration. Square 1:1 framing, plenty of breathing room around the plate.
NO text, NO chopsticks visible, NO watermark.`;
}

async function genOne(d) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${baseURL}/v1/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        prompt: buildPrompt(d),
        n: 1,
        size: "1024x1024",
      }),
    });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    if (!res.ok) {
      const t = (await res.text()).slice(0, 150);
      console.log(`✗ ${d.dayLabel}/${d.slotLabel} ${d.name}: ${res.status} ${elapsed}s — ${t}`);
      return null;
    }
    const data = await res.json();
    const item = data.data?.[0];
    if (!item) {
      console.log(`✗ ${d.dayLabel}/${d.slotLabel} ${d.name}: no item`);
      return null;
    }
    let buf;
    if (item.b64_json) buf = Buffer.from(item.b64_json, "base64");
    else if (item.url?.startsWith("data:"))
      buf = Buffer.from(item.url.split(",")[1], "base64");
    else {
      const rr = await fetch(item.url);
      buf = Buffer.from(await rr.arrayBuffer());
    }
    const out = join(DEST, d.filename);
    await writeFile(out, buf);
    console.log(
      `✓ ${d.dayLabel}/${d.slotLabel} ${d.name}: ${(buf.length / 1024).toFixed(0)}KB ${elapsed}s`,
    );
    return out;
  } catch (e) {
    console.log(`✗ ${d.dayLabel}/${d.slotLabel} ${d.name}: ${e.message}`);
    return null;
  }
}

// Process in parallel batches of N
async function runBatched(items, n, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += n) {
    const batch = items.slice(i, i + n);
    const r = await Promise.all(batch.map(fn));
    results.push(...r);
  }
  return results;
}

const t0 = Date.now();
const results = await runBatched(dishes, PARALLEL, genOne);
const ok = results.filter(Boolean).length;
const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
console.log(`\ndone · ${ok}/${dishes.length} ok · ${elapsed}s total`);
