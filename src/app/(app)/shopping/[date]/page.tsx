import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ShoppingList } from "@/components/shopping-list";
import {
  aggregateIngredients,
  getOrCreateWeek,
  getShoppingListByWeekStart,
  mondayOf,
} from "@/lib/db";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六"] as const;

export default async function DayShoppingPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return <NotFound message="日期格式无效" />;
  }

  // Find which week contains this date — try the active week first, then
  // last week (so a Sat → Sun preview still resolves)
  const monday = mondayOf();
  const week = await getOrCreateWeek(monday);
  let day = week.days.find((d) => d.date === date);
  let weekStart = monday;
  if (!day) {
    const prevMonday = new Date(monday);
    prevMonday.setDate(prevMonday.getDate() - 7);
    const prev = await getOrCreateWeek(prevMonday);
    day = prev.days.find((d) => d.date === date);
    weekStart = prevMonday;
  }
  if (!day) return <NotFound message={`没找到 ${date} 的菜单`} />;

  const filledDishes = day.dishes.filter((d) => d.name.trim());
  if (filledDishes.length === 0) {
    return <NotFound message={`${date} 还未编排菜单`} />;
  }

  const list = await getShoppingListByWeekStart(weekStart);
  // Single-day items aggregated fresh
  const dayItems = aggregateIngredients([day]);
  // Sync checked state with the canonical weekly list (so toggling here
  // toggles in the weekly list — same source of truth)
  const weeklyByName = new Map(
    (list?.items ?? []).map((i) => [i.name, i.checked]),
  );
  const items = dayItems.map((d) => ({
    ...d,
    checked: weeklyByName.get(d.name) ?? false,
  }));

  // Find weekday label
  const dayIdx = week.days.findIndex((d) => d.date === date);
  const weekdayLabel =
    dayIdx >= 0 && dayIdx < WEEKDAYS.length ? WEEKDAYS[dayIdx] : "";

  return (
    <div className="space-y-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-primary"
      >
        <ChevronLeft className="size-4" />
        返回首页
      </Link>

      <div className="rounded-md border p-4">
        <h3 className="font-display text-2xl tracking-wide">
          {date.slice(5).replace("-", "月")}日
          {weekdayLabel ? ` · ${weekdayLabel}` : ""} · 备料清单
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          为当日 {filledDishes.length} 道菜准备：
          {filledDishes.map((d) => d.name).join("、")}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          勾选状态与本周整体清单同步（同一食材在多日间共享）
        </p>
      </div>

      {list ? (
        <ShoppingList listId={list.id} items={items} />
      ) : (
        <p className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
          本周整体采购清单还未生成，请先在
          <Link
            href="/menu"
            className="mx-1 text-primary underline-offset-2 hover:underline"
          >
            本周菜单
          </Link>
          页保存一次菜单。
        </p>
      )}
    </div>
  );
}

function NotFound({ message }: { message: string }) {
  return (
    <div className="space-y-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-primary"
      >
        <ChevronLeft className="size-4" />
        返回首页
      </Link>
      <div className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        {message}
      </div>
    </div>
  );
}
