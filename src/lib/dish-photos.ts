import "server-only";
import { uploadToR2 } from "@/lib/r2";
import type { DayInput } from "@/lib/shared";

const PARALLEL = 5;
const DISH_PHOTOS_PREFIX = "dish-images";

export { DISH_PHOTOS_PREFIX };

interface Dish {
  dayIdx: number;
  slotIdx: number;
  name: string;
  ingredients: string;
  filename: string;
}

function buildPrompt(d: Dish): string {
  return `Top-down professional food photography of one Chinese home dish: ${d.name}.
Key ingredients visible: ${d.ingredients}
Plating: single white porcelain bowl or oval plate, centered on the canvas, light wood or matte concrete surface beneath. Soft, diffused natural daylight from above. Shallow depth of field, sharp focus on the food.
Style: clean, magazine quality, MUJI / Kinfolk aesthetic. Photoreal, NOT illustration. Square 1:1 framing, plenty of breathing room around the plate.
NO text, NO chopsticks visible, NO watermark.`;
}

async function genOne(
  d: Dish,
  model: string,
): Promise<{ ok: true; url: string; ms: number } | { ok: false; reason: string }> {
  const baseURL = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  if (!baseURL || !apiKey) return { ok: false, reason: "AI env missing" };
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
        prompt: buildPrompt(d),
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
    const data = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
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
    const key = `${DISH_PHOTOS_PREFIX}/${d.filename}`;
    const url = await uploadToR2(key, buf, "image/png");
    return { ok: true, url, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

export async function generateDishPhotosForWeek(opts: {
  days: DayInput[];
  model?: string;
  onProgress?: (msg: string) => void;
}): Promise<{ ok: number; failed: number; total: number }> {
  const model = opts.model ?? process.env.AI_MODEL_IMAGE ?? "gpt-image-2";
  const onProgress = opts.onProgress ?? (() => {});

  const dishes: Dish[] = opts.days.flatMap((day, di) =>
    day.dishes.flatMap((dish, si) =>
      dish.name?.trim()
        ? [
            {
              dayIdx: di,
              slotIdx: si,
              name: dish.name.trim(),
              ingredients: dish.ingredients?.trim() ?? "",
              filename: `d${di + 1}-s${si}.png`,
            },
          ]
        : [],
    ),
  );

  onProgress(`generating ${dishes.length} dish photos with ${model} (parallel=${PARALLEL})`);
  let okCount = 0;
  let failedCount = 0;

  for (let i = 0; i < dishes.length; i += PARALLEL) {
    const batch = dishes.slice(i, i + PARALLEL);
    const results = await Promise.all(batch.map((d) => genOne(d, model)));
    for (let k = 0; k < batch.length; k++) {
      const d = batch[k];
      const r = results[k];
      if (r.ok) {
        okCount++;
        onProgress(
          `✓ ${d.name} · ${(r.ms / 1000).toFixed(1)}s (${okCount}/${dishes.length})`,
        );
      } else {
        failedCount++;
        onProgress(`✗ ${d.name} · ${r.reason}`);
      }
    }
  }

  return { ok: okCount, failed: failedCount, total: dishes.length };
}
