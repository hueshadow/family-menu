import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { composeDayBoard, DAY_BOARDS_DIR } from "@/lib/day-board";
import { getOrCreateWeek, mondayOf } from "@/lib/db";
import { TABLE_PHOTOS_DIR } from "@/lib/table-photo";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六"];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ date: string }> },
) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response("invalid date", { status: 400 });
  }
  const cached = join(DAY_BOARDS_DIR, `${date}.png`);

  // Try cache first
  try {
    const buf = await readFile(cached);
    return imagePngResponse(buf, date);
  } catch {
    /* miss → generate */
  }

  // Find day
  const monday = mondayOf();
  const week = await getOrCreateWeek(monday);
  let day = week.days.find((d) => d.date === date) ?? null;
  let dayIdx = day ? week.days.findIndex((d) => d.date === date) : -1;
  if (!day) {
    const prev = new Date(monday);
    prev.setDate(prev.getDate() - 7);
    const prevWeek = await getOrCreateWeek(prev);
    day = prevWeek.days.find((d) => d.date === date) ?? null;
    dayIdx = day ? prevWeek.days.findIndex((d) => d.date === date) : -1;
  }
  if (!day) return new Response("day not in current/prev week", { status: 404 });

  let hasTable = false;
  try {
    await access(join(TABLE_PHOTOS_DIR, `${date}.png`));
    hasTable = true;
  } catch {
    /* no table photo */
  }

  try {
    await composeDayBoard({
      date,
      weekdayLabel: WEEKDAYS[dayIdx] ?? "",
      dayIdx,
      dishes: day.dishes,
      hasTable,
    });
    const buf = await readFile(cached);
    return imagePngResponse(buf, date);
  } catch (e) {
    return new Response(
      `compose failed: ${e instanceof Error ? e.message : String(e)}`,
      { status: 500 },
    );
  }
}

function imagePngResponse(buf: Buffer, date: string) {
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
      "Content-Disposition": `inline; filename="${date}-menu.png"`,
    },
  });
}
