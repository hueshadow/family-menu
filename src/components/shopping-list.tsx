"use client";

import { useOptimistic, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { toggleShoppingItemAction } from "@/app/actions";
import { CATEGORY_LABELS, type ShoppingItem } from "@/lib/shared";

export function ShoppingList({
  listId,
  items,
}: {
  listId: string;
  items: ShoppingItem[];
}) {
  const [optimisticItems, setOptimisticItems] = useOptimistic(
    items,
    (prev, next: { name: string; checked: boolean }) =>
      prev.map((i) => (i.name === next.name ? { ...i, checked: next.checked } : i)),
  );
  const [, startTransition] = useTransition();

  const grouped = new Map<string, ShoppingItem[]>();
  for (const i of optimisticItems) {
    const arr = grouped.get(i.category) ?? [];
    arr.push(i);
    grouped.set(i.category, arr);
  }
  const total = optimisticItems.length;
  const done = optimisticItems.filter((i) => i.checked).length;

  const onToggle = (name: string, checked: boolean) => {
    startTransition(async () => {
      setOptimisticItems({ name, checked });
      await toggleShoppingItemAction(listId, name, checked);
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-md border p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-base text-muted-foreground">本周进度</p>
          <p className="text-lg font-medium">
            {done} / {total}
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-foreground transition-all"
            style={{ width: total ? `${(done / total) * 100}%` : 0 }}
          />
        </div>
      </div>

      {[...grouped.entries()].map(([cat, arr]) => (
        <section key={cat} className="space-y-2">
          <h4 className="text-lg font-semibold">{CATEGORY_LABELS[cat] ?? cat}</h4>
          <ul className="space-y-2">
            {arr.map((item) => (
              <li
                key={item.name}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <Checkbox
                  id={`item-${item.name}`}
                  checked={item.checked}
                  onCheckedChange={(c) => onToggle(item.name, !!c)}
                  className="size-6"
                />
                <label
                  htmlFor={`item-${item.name}`}
                  className={`flex-1 text-base ${item.checked ? "line-through text-muted-foreground" : ""}`}
                >
                  {item.name}
                  {item.qty ? (
                    <span className="ml-2 text-sm text-muted-foreground">
                      {item.qty}
                    </span>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
