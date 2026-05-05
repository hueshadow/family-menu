import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DISH_PHOTOS_DIR } from "@/lib/dish-photos";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ dayIdx: string; slotIdx: string }> },
) {
  const { dayIdx, slotIdx } = await params;
  if (!/^\d+$/.test(dayIdx) || !/^\d+$/.test(slotIdx)) {
    return new Response("invalid params", { status: 400 });
  }

  const path = join(DISH_PHOTOS_DIR, `d${dayIdx}-s${slotIdx}.png`);
  try {
    const buf = await readFile(path);
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
