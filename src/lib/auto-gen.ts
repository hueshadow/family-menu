import "server-only";
import {
  aggregateAndStoreShoppingList,
  getLatestDietaryProfiles,
  getMembers,
  getOrCreateWeek,
  getRecentWeeksMenu,
  isoDate,
  query,
  saveWeek,
} from "@/lib/db";
import { generateDishPhotosForWeek } from "@/lib/dish-photos";
import { generateWeekMenu } from "@/lib/menu-gen";
import { composeMenuBoard } from "@/lib/menu-board";

export async function runAutoWeekGeneration(
  weekStart: Date,
): Promise<{ status: "generated" | "skipped" | "error"; reason: string }> {
  try {
    const week = await getOrCreateWeek(weekStart);
    const hasContent = week.days.some((d) =>
      d.dishes.some((x) => x.name.trim()),
    );
    if (hasContent) {
      return { status: "skipped", reason: `week ${isoDate(weekStart)} already has content` };
    }

    const [members, profiles] = await Promise.all([
      getMembers(),
      getLatestDietaryProfiles(),
    ]);
    const dietary = new Map(
      profiles.map((p) => [
        p.member_id,
        {
          tags: p.tags,
          recommend: p.recommend,
          avoid: p.avoid,
          rationale: p.rationale,
        },
      ]),
    );
    const recent = await getRecentWeeksMenu(weekStart, 3);
    const recentDishes = Array.from(new Set(recent.flatMap((r) => r.dishes)));
    const weekDates = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return isoDate(d);
    });

    const days = await generateWeekMenu({
      members,
      weekDates,
      recentDishes,
      dietary,
    });
    await saveWeek(week.id, days);
    await aggregateAndStoreShoppingList(week.id, days);
    await query(
      `update weekly_menus set auto_generated = true where id = $1`,
      [week.id],
    );

    // Image pipeline (failure does NOT abort menu generation — purely cosmetic)
    void runImagePipeline(weekStart, days).catch((e) => {
      console.error("[auto-gen] image pipeline failed:", e);
    });

    return { status: "generated", reason: `week ${isoDate(weekStart)} ${days.length} days · image pipeline detached` };
  } catch (e) {
    return {
      status: "error",
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

async function runImagePipeline(
  weekStart: Date,
  days: Parameters<typeof generateDishPhotosForWeek>[0]["days"],
): Promise<void> {
  console.log("[auto-gen] starting image pipeline (~7 min)…");
  const t0 = Date.now();
  const result = await generateDishPhotosForWeek({
    days,
    onProgress: (msg) => console.log(`[auto-gen·dish-photos] ${msg}`),
  });
  console.log(
    `[auto-gen] dish photos · ${result.ok}/${result.total} ok · ${((Date.now() - t0) / 1000).toFixed(0)}s`,
  );
  if (result.ok === 0) {
    console.warn("[auto-gen] no photos generated, skipping board composition");
    return;
  }
  const boardPath = await composeMenuBoard({
    weekStart: isoDate(weekStart),
    days,
  });
  console.log(`[auto-gen] menu board → ${boardPath}`);
}
