// Pure formatters for WeChat-friendly text sharing. No server-only deps.

import {
  DISH_ICONS,
  DISH_SLOTS,
  WEEKDAYS,
  type DayInput,
  type ShoppingItem,
} from "@/lib/shared";

const FOOTER = "— 来自 family-menu";

function chineseMonthDay(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}月${d}日`;
}

function weekdayChinese(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return WEEKDAYS[(d.getDay() + 6) % 7] ?? "";
}

export function formatWeekMenu(days: DayInput[]): string {
  if (days.length === 0) return "本周菜单还没生成。";
  const start = chineseMonthDay(days[0].date);
  const end = chineseMonthDay(days[days.length - 1].date);

  const sections = days.map((day, i) => {
    const wd = WEEKDAYS[i] ?? weekdayChinese(day.date);
    const md = chineseMonthDay(day.date);
    const lines = day.dishes
      .map((dish, dishi) => {
        const name = dish.name?.trim();
        if (!name) return null;
        const slot = DISH_SLOTS[dishi];
        const icon = DISH_ICONS[dishi];
        return `　${icon} ${slot}　${name}`;
      })
      .filter(Boolean)
      .join("\n");
    if (!lines) return null;
    const styleLine = day.style?.trim() ? `\n风格：${day.style.trim()}` : "";
    return `【${wd} ${md}】${styleLine}\n${lines}`;
  });

  const body = sections.filter(Boolean).join("\n\n");
  return `🍱 本周菜单 · ${start} – ${end}\n\n${body}\n\n${FOOTER}`;
}

export function formatDayMenu(day: DayInput): string {
  const md = chineseMonthDay(day.date);
  const wd = weekdayChinese(day.date);
  const sections = day.dishes
    .map((dish, i) => {
      const name = dish.name?.trim();
      if (!name) return null;
      const icon = DISH_ICONS[i];
      const ingredients = dish.ingredients?.trim();
      return ingredients ? `${icon} ${name}\n　${ingredients}` : `${icon} ${name}`;
    })
    .filter(Boolean);
  if (sections.length === 0) {
    return `🍱 ${md} · ${wd}\n\n（今日菜单还没生成）\n\n${FOOTER}`;
  }
  const styleLine = day.style?.trim() ? `\n风格：${day.style.trim()}` : "";
  return `🍱 ${md} · ${wd}${styleLine}\n\n${sections.join("\n\n")}\n\n${FOOTER}`;
}

const CATEGORY_ORDER = [
  "protein",
  "vegetable",
  "dairy",
  "fruit",
  "grain",
  "seasoning",
  "other",
];
const CATEGORY_HEADER: Record<string, string> = {
  protein: "🐟 蛋白类",
  vegetable: "🥬 蔬菜",
  dairy: "🥛 奶制品",
  fruit: "🍎 水果",
  grain: "🌾 主食",
  seasoning: "🧂 调味",
  other: "📦 其他",
};

export function formatShoppingList(
  items: ShoppingItem[],
  opts: { onlyUnchecked?: boolean } = { onlyUnchecked: true },
): string {
  // Pantry seasonings are NOT shared — 奶奶 doesn't need to be told to buy soy sauce.
  // She can confirm pantry stock in the app instead.
  const buyItems = items.filter((i) => (i.kind ?? "buy") === "buy");
  const filtered = opts.onlyUnchecked
    ? buyItems.filter((i) => !i.checked)
    : buyItems;
  if (filtered.length === 0) {
    return opts.onlyUnchecked
      ? `🛒 本周采购清单\n\n本周已全部购齐 ✅\n\n${FOOTER}`
      : `🛒 本周采购清单\n\n（无内容）\n\n${FOOTER}`;
  }

  const grouped = new Map<string, ShoppingItem[]>();
  for (const i of filtered) {
    const arr = grouped.get(i.category) ?? [];
    arr.push(i);
    grouped.set(i.category, arr);
  }

  const cats = CATEGORY_ORDER.filter((c) => grouped.has(c) && c !== "seasoning");
  for (const c of grouped.keys()) {
    if (!cats.includes(c) && c !== "seasoning") cats.push(c);
  }

  const sections = cats.map((cat) => {
    const arr = grouped.get(cat) ?? [];
    const header = CATEGORY_HEADER[cat] ?? cat;
    const lines = arr
      .map((it) => `　○ ${it.name}${it.qty ? ` ${it.qty}` : ""}`)
      .join("\n");
    return `${header}\n${lines}`;
  });

  const total = buyItems.length;
  const remaining = filtered.length;
  const headLine =
    opts.onlyUnchecked && remaining < total
      ? `🛒 本周采购清单 · 还有 ${remaining} / ${total} 项待购`
      : `🛒 本周采购清单 · 共 ${total} 项`;

  return `${headLine}\n\n${sections.join("\n\n")}\n\n${FOOTER}`;
}
