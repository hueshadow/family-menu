// Generate dining-table photo for each day of the current week.
// Usage: node --env-file=.env.local scripts/gen-table-photos.mjs

import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import pg from "pg";

const baseURL = process.env.AI_BASE_URL;
const apiKey = process.env.AI_API_KEY;
const MODEL = process.argv[2] || "gpt-image-2";
const PARALLEL = 3;
const DEST = join(homedir(), "Documents/family-menu-data/table-photos");
await mkdir(DEST, { recursive: true });

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
  "select days from weekly_menus where week_start = $1",
  [process.argv[3] || "2026-05-04"],
);
await c.end();
if (!r.rows.length) {
  console.error("no menu");
  process.exit(1);
}

const days = r.rows[0].days.filter((d) =>
  d.dishes.some((dish) => dish.name?.trim()),
);
console.log(`→ ${days.length} days, model=${MODEL}, parallel=${PARALLEL}`);

function buildPrompt(day) {
  const dishes = day.dishes.filter((d) => d.name?.trim()).map((d) => d.name.trim());
  return `Top-down overhead photograph of a complete Chinese family dinner table laid out for sharing.

The table has ${dishes.length} home-cooked dishes plated on white porcelain bowls and oval plates: ${dishes.join(" / ")}.

Composition: dishes arranged in a balanced minimalist layout on a light wood (or matte concrete) tabletop, with small pairs of natural-wood chopsticks resting beside the plates, a small celadon teacup at the corner. Generous breathing room between plates.

Lighting: soft, diffused natural daylight from a side window, gentle shadows, no harsh highlights.

Style: editorial food photography, MUJI / Kinfolk aesthetic, photoreal, NOT illustration. Square 1:1 framing. Color palette is calm and muted — primarily warm whites, light woods, with the natural colors of the food itself.

NO text labels, NO watermark, NO people, NO additional decorative props beyond the chopsticks and teacup.`;
}

async function genOne(day) {
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
        prompt: buildPrompt(day),
        n: 1,
        size: "1024x1024",
      }),
    });
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    if (!res.ok) {
      console.log(`✗ ${day.date}: ${res.status} ${elapsed}s — ${(await res.text()).slice(0, 100)}`);
      return null;
    }
    const data = await res.json();
    const item = data.data?.[0];
    let buf;
    if (item.b64_json) buf = Buffer.from(item.b64_json, "base64");
    else if (item.url?.startsWith("data:")) buf = Buffer.from(item.url.split(",")[1], "base64");
    else { const rr = await fetch(item.url); buf = Buffer.from(await rr.arrayBuffer()); }
    const out = join(DEST, `${day.date}.png`);
    await writeFile(out, buf);
    console.log(`✓ ${day.date}: ${(buf.length / 1024).toFixed(0)}KB ${elapsed}s`);
    return out;
  } catch (e) {
    console.log(`✗ ${day.date}: ${e.message}`);
    return null;
  }
}

const t0 = Date.now();
const all = [];
for (let i = 0; i < days.length; i += PARALLEL) {
  const batch = days.slice(i, i + PARALLEL);
  const r = await Promise.all(batch.map(genOne));
  all.push(...r);
}
const ok = all.filter(Boolean).length;
console.log(`\ndone · ${ok}/${days.length} ok · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
