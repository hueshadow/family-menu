"use server";

import { revalidatePath } from "next/cache";
import {
  aggregateAndStoreShoppingList,
  getMembers,
  getRecentWeeksMenu,
  query,
  saveWeek,
  setShoppingItemChecked,
} from "@/lib/db";
import {
  generateRecipe,
  generateWeekMenu,
  getDishCandidates,
} from "@/lib/menu-gen";
import { type DayInput } from "@/lib/shared";
import { DISH_SLOTS } from "@/lib/shared";

export async function saveWeekAction(weekId: string, days: DayInput[]) {
  await saveWeek(weekId, days);
  await aggregateAndStoreShoppingList(weekId, days);
  revalidatePath("/mama");
  revalidatePath("/naina");
  revalidatePath("/ayi");
  return { ok: true };
}

export async function toggleShoppingItemAction(
  listId: string,
  itemName: string,
  checked: boolean,
) {
  await setShoppingItemChecked(listId, itemName, checked);
  revalidatePath("/naina");
  return { ok: true };
}

export async function generateWeekAction(
  weekId: string,
  weekStart: string,
): Promise<{ ok: true; days: DayInput[] } | { ok: false; error: string }> {
  try {
    const members = await getMembers();
    const startDate = new Date(weekStart);
    const recent = await getRecentWeeksMenu(startDate, 3);
    const recentDishes = Array.from(
      new Set(recent.flatMap((r) => r.dishes)),
    );
    const weekDates = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
    const days = await generateWeekMenu({
      members,
      weekDates,
      recentDishes,
    });
    await saveWeek(weekId, days);
    await aggregateAndStoreShoppingList(weekId, days);
    revalidatePath("/mama");
    revalidatePath("/naina");
    revalidatePath("/ayi");
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
    const members = await getMembers();
    const candidates = await getDishCandidates({
      members,
      slot,
      currentName,
      todayOtherDishes,
      weekOtherDishes,
    });
    return { ok: true, candidates };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
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
