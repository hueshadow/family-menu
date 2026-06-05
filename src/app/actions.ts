"use server";

import { revalidatePath } from "next/cache";
import {
  aggregateAndStoreShoppingList,
  getLatestDietaryProfiles,
  getMembers,
  getRecentWeeksMenu,
  isoDate,
  query,
  saveWeek,
  saveWeekAnalysis,
  setShoppingItemChecked,
  weekDates as buildWeekDates,
} from "@/lib/db";
import {
  analyzeWeekNutrition,
  generateRecipe,
  generateWeekMenu,
  getDishCandidates,
  getIngredientSubstitutes,
  type NutritionAnalysis,
  type Substitutes,
} from "@/lib/menu-gen";
import { type DayInput, type MemberRole } from "@/lib/shared";
import { DISH_SLOTS } from "@/lib/shared";

// =========================================================================
// NOTE: Health report processing (listReportFilesAction / processReportAction)
// depends on pdftotext/pdftoppm binaries + local filesystem — unavailable on
// Cloudflare Workers. These features are deferred pending a separate service.
// =========================================================================

export async function saveWeekAction(
  weekId: string,
  weekStart: string,
  days: DayInput[],
) {
  await saveWeek(weekId, days);
  await aggregateAndStoreShoppingList(weekId, days);
  // Image generation moved to Cloudflare Workflow — triggered via /api/generate
  revalidatePath("/");
  revalidatePath("/menu");
  revalidatePath("/shopping");
  revalidatePath("/today");
  return { ok: true };
}

export async function toggleShoppingItemAction(
  listId: string,
  itemName: string,
  checked: boolean,
) {
  await setShoppingItemChecked(listId, itemName, checked);
  revalidatePath("/shopping");
  return { ok: true };
}

export async function generateWeekAction(
  weekId: string,
  weekStart: string,
): Promise<{ ok: true; days: DayInput[] } | { ok: false; error: string }> {
  try {
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
    const startDate = new Date(weekStart);
    const recent = await getRecentWeeksMenu(startDate, 3);
    const recentDishes = Array.from(
      new Set(recent.flatMap((r) => r.dishes)),
    );
    const weekDates = buildWeekDates(startDate).map(isoDate);
    const days = await generateWeekMenu({
      members,
      weekDates,
      recentDishes,
      dietary,
    });
    await saveWeek(weekId, days);
    await aggregateAndStoreShoppingList(weekId, days);
    // Image generation moved to Cloudflare Workflow — triggered via /api/generate
    revalidatePath("/");
    revalidatePath("/menu");
    revalidatePath("/shopping");
    revalidatePath("/today");
    return { ok: true, days };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getCandidatesAction(opts: {
  weekId: string;
  dayIdx: number;
  dishIdx: number;
  days: DayInput[];
}): Promise<
  | { ok: true; candidates: { name: string; ingredients: string; reason?: string }[] }
  | { ok: false; error: string }
> {
  try {
    const slot = DISH_SLOTS[opts.dishIdx];
    if (!slot) throw new Error("invalid dish index");
    const day = opts.days[opts.dayIdx];
    const currentName = day.dishes[opts.dishIdx].name;
    const todayOtherDishes = day.dishes
      .filter((_, i) => i !== opts.dishIdx)
      .map((d) => d.name);
    const weekOtherDishes = opts.days
      .flatMap((d, di) =>
        d.dishes.map((dish, dishi) =>
          di === opts.dayIdx && dishi === opts.dishIdx ? "" : dish.name,
        ),
      )
      .filter(Boolean);
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
    const candidates = await getDishCandidates({
      members,
      slot,
      currentName,
      todayOtherDishes,
      weekOtherDishes,
      dietary,
    });
    return { ok: true, candidates };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ========== Nutrition analysis ==========

export async function analyzeNutritionAction(opts: {
  weekId?: string;
  days: DayInput[];
}): Promise<{ ok: true; analysis: NutritionAnalysis } | { ok: false; error: string }> {
  try {
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
    const analysis = await analyzeWeekNutrition({
      members,
      days: opts.days,
      dietary,
    });
    if (opts.weekId) {
      await saveWeekAnalysis(opts.weekId, analysis);
    }
    return { ok: true, analysis };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ========== Substitutes ==========

export async function getSubstitutesAction(opts: {
  ingredient: string;
  dishName: string;
}): Promise<
  | { ok: true; substitutes: Substitutes["substitutes"] }
  | { ok: false; error: string }
> {
  try {
    const members = await getMembers();
    const subs = await getIngredientSubstitutes({
      ingredient: opts.ingredient,
      dishName: opts.dishName,
      members,
    });
    return { ok: true, substitutes: subs };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ========== Weekly menu history ==========

export async function listWeeksAction(): Promise<
  Array<{ id: string; week_start: string; status: string; dishes: string[] }>
> {
  const rows = await query<{
    id: string;
    week_start: string;
    status: string;
    days: { date: string; dishes: { name: string }[] }[];
  }>(
    `select id, week_start::text, status, days from weekly_menus
     order by week_start desc limit 50`,
  );
  return rows.map((r) => ({
    id: r.id,
    week_start: r.week_start,
    status: r.status,
    dishes: r.days
      .flatMap((d) => d.dishes.map((x) => x.name))
      .filter(Boolean)
      .slice(0, 8),
  }));
}

// ========== Health reports ==========
// DISABLED on Workers: pdftotext/pdftoppm binaries + local filesystem unavailable.
// These features are deferred pending a separate service deployment.

// Keep the interface for type compatibility with existing UI components
export interface ReportFileSummary {
  filename: string;
  size: number;
  pages: number;
  guessedRole: MemberRole | null;
  alreadyProcessed: boolean;
}

export async function listReportFilesAction(): Promise<ReportFileSummary[]> {
  console.warn("[actions] Health report file scanning not available on Workers");
  return [];
}

export async function processReportAction(_opts: {
  memberId: string;
  filename: string;
}): Promise<
  | { ok: true; abnormalCount: number; ocrUsed: boolean; profileTags: string[] }
  | { ok: false; error: string }
> {
  return { ok: false, error: "Health report processing not available on Workers. PDF extraction requires pdftotext/pdftoppm binaries (poppler). This feature is deferred." };
}

export async function generateRecipeAction(
  dishName: string,
  ingredients: string,
): Promise<
  { ok: true; steps: string; tips?: string }
  | { ok: false; error: string }
> {
  try {
    const existing = await query<{ steps: string; notes: string | null }>(
      "select steps, notes from recipes where name = $1 limit 1",
      [dishName],
    );
    if (existing[0]) {
      return {
        ok: true,
        steps: existing[0].steps,
        tips: existing[0].notes ?? undefined,
      };
    }
    const result = await generateRecipe({ dishName, ingredients });
    await query(
      `insert into recipes (name, ingredients, steps, tags, suitable_for, notes)
       values ($1, $2::jsonb, $3, $4, $5, $6)
       on conflict do nothing`,
      [
        dishName,
        JSON.stringify([]),
        result.steps,
        [],
        [],
        result.tips ?? null,
      ],
    );
    return { ok: true, steps: result.steps, tips: result.tips };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
