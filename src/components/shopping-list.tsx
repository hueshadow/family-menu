"use client";

import { useOptimistic, useTransition } from "react";
import { ShareButton } from "@/components/share-button";
import { Checkbox } from "@/components/ui/checkbox";
import { toggleShoppingItemAction } from "@/app/actions";
import { formatShoppingList } from "@/lib/share-formatter";
import { CATEGORY_LABELS, type ShoppingItem } from "@/lib/shared";

const PLATFORMS: Array<{ label: string; build: (q: string) => string }> = [
  {
    label: "盒马",
    build: (q) => `https://www.freshhema.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    label: "京东",
    build: (q) =>
      `https://search.jd.com/Search?keyword=${encodeURIComponent(q)}`,
  },
  {
    label: "美团",
    build: (q) =>
      `https://maicai.meituan.com/search/${encodeURIComponent(q)}`,
  },
];

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
      prev.map((i) =>
        i.name === next.name ? { ...i, checked: next.checked } : i,
      ),
  );
  const [, startTransition] = useTransition();

  const buyItems = optimisticItems.filter((i) => (i.kind ?? "buy") === "buy");
  const pantryItems = optimisticItems.filter((i) => i.kind === "pantry");

  const grouped = new Map<string, ShoppingItem[]>();
  for (const i of buyItems) {
    const arr = grouped.get(i.category) ?? [];
    arr.push(i);
    grouped.set(i.category, arr);
  }

  const total = buyItems.length;
  const done = buyItems.filter((i) => i.checked).length;

  const onToggle = (name: string, checked: boolean) => {
    startTransition(async () => {
      setOptimisticItems({ name, checked });
      await toggleShoppingItemAction(listId, name, checked);
    });
  };

  const onCopyAll = () => {
    const text = [...grouped.entries()]
      .map(
        ([cat, arr]) =>
          `${CATEGORY_LABELS[cat] ?? cat}\n${arr
            .filter((i) => !i.checked)
            .map((i) => `- ${i.name}${i.qty ? ` (${i.qty})` : ""}`)
            .join("\n")}`,
      )
      .join("\n\n");
    navigator.clipboard.writeText(text);
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
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <ShareButton
            text={() =>
              formatShoppingList(optimisticItems, { onlyUnchecked: true })
            }
            title="本周采购清单"
            label="分享至微信"
            size="sm"
          />
          <button
            type="button"
            onClick={onCopyAll}
            className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            复制纯文本
          </button>
        </div>
      </div>

      {[...grouped.entries()].map(([cat, arr]) => (
        <section key={cat} className="space-y-2">
          <h4 className="text-lg font-semibold">{CATEGORY_LABELS[cat] ?? cat}</h4>
          <ul className="space-y-2">
            {arr.map((item) => (
              <li
                key={item.name}
                className="flex flex-col gap-2 rounded-md border p-3"
              >
                <div className="flex items-center gap-3">
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
                </div>
                {!item.checked ? (
                  <div className="flex flex-wrap gap-2 pl-9 text-xs">
                    {PLATFORMS.map((p) => (
                      <a
                        key={p.label}
                        href={p.build(item.name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded border px-2 py-0.5 text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                      >
                        🔍 {p.label}
                      </a>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {pantryItems.length > 0 ? (
        <section className="space-y-2 rounded-md border border-dashed border-border/60 bg-muted/20 p-4">
          <div>
            <h4 className="text-lg font-semibold">
              {CATEGORY_LABELS.seasoning ?? "🧂 调味品 · 确认家中库存"}
            </h4>
            <p className="text-xs text-muted-foreground">
              下列为日常调味品和小用量配料 — 不必单独采购，按需勾选确认家里还有
            </p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {pantryItems.map((item) => (
              <li
                key={item.name}
                className="flex items-center gap-3 rounded-md border border-border/40 bg-card/40 p-2.5"
              >
                <Checkbox
                  id={`pantry-${item.name}`}
                  checked={item.checked}
                  onCheckedChange={(c) => onToggle(item.name, !!c)}
                  className="size-5"
                />
                <label
                  htmlFor={`pantry-${item.name}`}
                  className={`flex-1 text-sm ${item.checked ? "line-through text-muted-foreground" : ""}`}
                >
                  {item.name}
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
