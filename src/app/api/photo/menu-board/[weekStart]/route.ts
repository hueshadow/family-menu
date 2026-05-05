import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MENU_BOARDS_DIR } from "@/lib/menu-board";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ weekStart: string }> },
) {
  const { weekStart } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return new Response("invalid weekStart", { status: 400 });
  }
  const path = join(MENU_BOARDS_DIR, `${weekStart}_week_real.png`);
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
