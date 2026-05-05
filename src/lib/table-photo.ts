import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { DayInput } from "@/lib/shared";

const PARALLEL = 3;
const DEST = join(homedir(), "Documents/family-menu-data/table-photos");

interface Day {
  date: string;
  dishes: { name: string; ingredients: string }[];
}

function buildPrompt(day: Day): string {
  const dishes = day.dishes
    .filter((d) => d.name?.trim())
    .map((d) => d.name.trim());
  if (dishes.length === 0) return "";
  return `Top-down overhead photograph of a complete Chinese family dinner table laid out for sharing.

The table has ${dishes.length} home-cooked dishes plated on white porcelain bowls and oval plates: ${dishes.join(" / ")}.

Composition: dishes arranged in a balanced minimalist layout on a light wood (or matte concrete) tabletop, with small pairs of natural-wood chopsticks resting beside the plates, a small celadon teacup at the corner. Generous breathing room between plates.

Lighting: soft, diffused natural daylight from a side window, gentle shadows, no harsh highlights.

Style: editorial food photography, MUJI / Kinfolk aesthetic, photoreal, NOT illustration. Square 1:1 framing. Color palette is calm and muted — primarily warm whites, light woods, with the natural colors of the food itself.

NO text labels, NO watermark, NO people, NO additional decorative props beyond the chopsticks and teacup.`;
}

async function genOne(
  day: Day,
  model: string,
): Promise<
  | { ok: true; path: string; ms: number }
  | { ok: false; reason: string }
> {
  const baseURL = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  if (!baseURL || !apiKey) return { ok: false, reason: "AI env missing" };
  const prompt = buildPrompt(day);
  if (!prompt) return { ok: false, reason: "no dishes" };
  const t0 = Date.now();
  try {
    const res = await fetch(`${baseURL}/v1/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size: "1024x1024",
      }),
    });
    if (!res.ok) {
      return {
        ok: false,
        reason: `${res.status} ${(await res.text()).slice(0, 150)}`,
      };
    }
    const data = (await res.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    const item = data.data?.[0];
    if (!item) return { ok: false, reason: "no item" };
    let buf: Buffer;
    if (item.b64_json) {
      buf = Buffer.from(item.b64_json, "base64");
    } else if (item.url?.startsWith("data:")) {
      buf = Buffer.from(item.url.split(",")[1], "base64");
    } else if (item.url) {
      const r = await fetch(item.url);
      buf = Buffer.from(await r.arrayBuffer());
    } else {
      return { ok: false, reason: "no image data" };
    }
    const path = join(DEST, `${day.date}.png`);
    await writeFile(path, buf);
    return { ok: true, path, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

export async function generateWeekTablePhotos(opts: {
  days: DayInput[];
  model?: string;
  onProgress?: (msg: string) => void;
}): Promise<{ ok: number; failed: number; total: number }> {
  await mkdir(DEST, { recursive: true });
  const model = opts.model ?? process.env.AI_MODEL_IMAGE ?? "gpt-image-2";
  const onProgress = opts.onProgress ?? (() => {});

  const days: Day[] = opts.days.filter((d) =>
    d.dishes.some((dish) => dish.name?.trim()),
  );
  onProgress(
    `generating ${days.length} table photos with ${model} (parallel=${PARALLEL})`,
  );

  let okCount = 0;
  let failedCount = 0;
  for (let i = 0; i < days.length; i += PARALLEL) {
    const batch = days.slice(i, i + PARALLEL);
    const results = await Promise.all(batch.map((d) => genOne(d, model)));
    for (let k = 0; k < batch.length; k++) {
      const day = batch[k];
      const r = results[k];
      if (r.ok) {
        okCount++;
        onProgress(
          `✓ ${day.date} table · ${(r.ms / 1000).toFixed(1)}s (${okCount}/${days.length})`,
        );
      } else {
        failedCount++;
        onProgress(`✗ ${day.date} table · ${r.reason}`);
      }
    }
  }
  return { ok: okCount, failed: failedCount, total: days.length };
}

export const TABLE_PHOTOS_DIR = DEST;
