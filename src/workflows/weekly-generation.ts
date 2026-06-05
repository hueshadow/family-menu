// =========================================================================
// Weekly Menu Generation Workflow
// 由 Cron Trigger (周日 01:00 UTC) 或手动 /api/generate 触发。
// 分步执行，每步可独立重试；Workflow 持久化状态天然防重入。
// =========================================================================

import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";

import { generateWeekMenu } from "@/lib/menu-gen";
import { generateDishPhotosForWeek } from "@/lib/dish-photos";
import { generateWeekTablePhotos } from "@/lib/table-photo";
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
import type { DayInput } from "@/lib/shared";

// Env bindings — injected by Cloudflare Workers platform
interface Env {
  HYPERDRIVE: Hyperdrive;
  FAMILY_IMAGES: R2Bucket;
  AI_BASE_URL: string;
  AI_API_KEY: string;
}

interface Params {
  weekStart: string; // YYYY-MM-DD — the Monday of the target week
  trigger: "cron" | "manual";
}

interface StepOutput {
  status: "generated" | "skipped" | "error";
  reason?: string;
  dishPhotos?: string;
  tablePhotos?: string;
  boardUrl?: string | null;
}

export class WeeklyGeneration extends WorkflowEntrypoint<Env, Params> {
  async run(
    event: WorkflowEvent<Params>,
    step: WorkflowStep,
  ): Promise<StepOutput> {
    const weekStart = new Date(event.payload.weekStart);
    const wsIso = isoDate(weekStart);

    console.log(
      `[workflow] starting weekly generation for ${wsIso} (trigger: ${event.payload.trigger})`,
    );

    // -------------------------------------------------------
    // Step 1: Generate menu via AI
    // -------------------------------------------------------
    const week = await step.do("generate menu", async () => {
      const w = await getOrCreateWeek(weekStart);
      const hasContent = w.days.some((d) =>
        d.dishes.some((x) => x.name.trim()),
      );
      if (hasContent) {
        return { skipped: true, weekId: w.id, days: [] as DayInput[] };
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
      const recentDishes = Array.from(
        new Set(recent.flatMap((r) => r.dishes)),
      );
      const weekDates = buildWeekDates(weekStart).map(isoDate);

      const days = await generateWeekMenu({
        members,
        weekDates,
        recentDishes,
        dietary,
      });
      await saveWeek(w.id, days);
      await aggregateAndStoreShoppingList(w.id, days);
      await query(
        `update weekly_menus set auto_generated = true where id = $1`,
        [w.id],
      );

      return { skipped: false, weekId: w.id, days };
    });

    if (week.skipped) {
      return {
        status: "skipped",
        reason: `week ${wsIso} already has content`,
      };
    }

    // -------------------------------------------------------
    // Step 2: Generate dish photos
    // -------------------------------------------------------
    const dishResult = await step.do("generate dish photos", async () => {
      const result = await generateDishPhotosForWeek({
        days: week.days,
        onProgress: (msg) => console.log(`[workflow·dish] ${msg}`),
      });
      return `${result.ok}/${result.total} ok`;
    });

    // -------------------------------------------------------
    // Step 3: Generate table photos
    // -------------------------------------------------------
    const tableResult = await step.do("generate table photos", async () => {
      const result = await generateWeekTablePhotos({
        days: week.days,
        onProgress: (msg) => console.log(`[workflow·table] ${msg}`),
      });
      return `${result.ok}/${result.total} ok`;
    });

    // -------------------------------------------------------
    // Step 4: Generate menu board (satori poster)
    // -------------------------------------------------------
    let boardUrl: string | null = null;
    if (dishResult.startsWith("0/")) {
      console.warn("[workflow] no dish photos, skipping board");
    } else {
      boardUrl = await step.do("generate menu board", async () => {
        try {
          const { composeMenuBoard } = await import("@/lib/menu-board");
          return await composeMenuBoard({
            weekStart: wsIso,
            days: week.days,
          });
        } catch (e) {
          console.error("[workflow·board] failed:", e);
          return null;
        }
      });
    }

    return {
      status: "generated",
      dishPhotos: dishResult,
      tablePhotos: tableResult,
      boardUrl,
    };
  }
}
