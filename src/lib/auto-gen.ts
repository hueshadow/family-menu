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
  weekDates as buildWeekDates,
} from "@/lib/db";
import { generateDishPhotosForWeek } from "@/lib/dish-photos";
import { generateWeekMenu } from "@/lib/menu-gen";
import { composeMenuBoard } from "@/lib/menu-board";
import { generateWeekTablePhotos } from "@/lib/table-photo";
import type { DayInput } from "@/lib/shared";

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
    const weekDates = buildWeekDates(weekStart).map(isoDate);

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

    // Image pipeline runs in a detached child process so Chrome OOM can't kill the web service.
    void spawnImagePipeline(weekStart, days).catch((e) => {
      console.error("[auto-gen] failed to spawn image pipeline:", e);
    });

    return { status: "generated", reason: `week ${isoDate(weekStart)} ${days.length} days · image pipeline spawned` };
  } catch (e) {
    return {
      status: "error",
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * 在独立子进程里运行图片流水线（Node.js 专用）。
 * detached + unref，子进程 OOM / Chrome 崩溃只杀子进程，Web 服务进程不受影响。
 */
async function spawnImagePipeline(weekStart: Date, days: DayInput[]): Promise<void> {
  const { writeFile } = await import("node:fs/promises");
  const { openSync, closeSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { spawn } = await import("node:child_process");

  const stamp = Date.now();
  const dataPath = `/tmp/family-menu-pipeline-${stamp}.json`;
  const logPath = `/tmp/family-menu-pipeline-${stamp}.log`;
  await writeFile(dataPath, JSON.stringify({ weekStart: isoDate(weekStart), days }), "utf8");

  // Worker stdout+stderr → log file; parent closes its fd copy immediately after spawn.
  const logFd = openSync(logPath, "w");
  const workerPath = join(process.cwd(), "scripts/image-pipeline-worker.mjs");
  const child = spawn(process.execPath, [workerPath, dataPath], {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: process.env as NodeJS.ProcessEnv,
  });
  closeSync(logFd); // parent closes its copy; child inherits and continues writing

  // Exit handler fires when worker finishes (or crashes); does not keep event loop alive.
  child.on("exit", (code, signal) => {
    console.log(
      `[auto-gen] pipeline worker done · PID=${child.pid} · exit=${code ?? signal} · log=${logPath}`,
    );
  });
  child.unref();
  console.log(`[auto-gen] image pipeline spawned · PID=${child.pid} · week=${isoDate(weekStart)} · log=${logPath}`);
}

export async function runImagePipeline(
  weekStart: Date,
  days: Parameters<typeof generateDishPhotosForWeek>[0]["days"],
): Promise<void> {
  console.log("[auto-gen] starting image pipeline (~10 min)…");
  const t0 = Date.now();

  const dishResult = await generateDishPhotosForWeek({
    days,
    onProgress: (msg) => console.log(`[auto-gen·dish-photos] ${msg}`),
  });
  console.log(
    `[auto-gen] dish photos · ${dishResult.ok}/${dishResult.total} ok · ${((Date.now() - t0) / 1000).toFixed(0)}s`,
  );

  const tableResult = await generateWeekTablePhotos({
    days,
    onProgress: (msg) => console.log(`[auto-gen·table-photos] ${msg}`),
  });
  console.log(
    `[auto-gen] table photos · ${tableResult.ok}/${tableResult.total} ok · ${((Date.now() - t0) / 1000).toFixed(0)}s`,
  );

  if (dishResult.ok === 0) {
    console.warn("[auto-gen] no dish photos, skipping board composition");
    return;
  }
  const boardPath = await composeMenuBoard({
    weekStart: isoDate(weekStart),
    days,
  });
  console.log(`[auto-gen] menu board → ${boardPath}`);
}
