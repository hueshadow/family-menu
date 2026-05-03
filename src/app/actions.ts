"use server";

import { revalidatePath } from "next/cache";
import {
  aggregateAndStoreShoppingList,
  type DayInput,
  saveWeek,
  setShoppingItemChecked,
} from "@/lib/db";

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
