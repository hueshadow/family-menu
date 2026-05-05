import { access } from "node:fs/promises";
import { join } from "node:path";
import Link from "next/link";
import { ArrowRight, ClipboardList, Sunrise, Utensils } from "lucide-react";
// Smart day card: before 13:00 → today's menu (label "今日");
// from 13:00 onward → tomorrow's menu (label "明日"). Rolls into next day at midnight.
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrCreateWeek, isoDate, mondayOf } from "@/lib/db";
import { DISH_PHOTOS_DIR } from "@/lib/dish-photos";
import { describeSeasonal } from "@/lib/seasonal";
import { DISH_ICONS, WEEKDAYS } from "@/lib/shared";
import { TABLE_PHOTOS_DIR } from "@/lib/table-photo";

export const dynamic = "force-dynamic";

export default async function Home() {
  const monday = mondayOf();
  const week = await getOrCreateWeek(monday);
  const seasonal = describeSeasonal();

  // Smart day target: today before 13:00, otherwise tomorrow.
  const now = new Date();
  const showTomorrow = now.getHours() >= 13;
  const targetDate = new Date(now);
  targetDate.setHours(0, 0, 0, 0);
  if (showTomorrow) {
    targetDate.setDate(targetDate.getDate() + 1);
  }
  const targetIso = isoDate(targetDate);
  const target = week.days.find((d) => d.date === targetIso) ?? null;
  const targetDayIdx = target
    ? week.days.findIndex((d) => d.date === targetIso)
    : -1;
  const targetWeekdayLabel = targetDate.toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  const targetTitle = showTomorrow ? "明日" : "今日";
  let hasTargetTablePhoto = false;
  if (target) {
    try {
      await access(join(TABLE_PHOTOS_DIR, `${targetIso}.png`));
      hasTargetTablePhoto = true;
    } catch {
      hasTargetTablePhoto = false;
    }
  }
  const targetDishPhotos = target
    ? await Promise.all(
        target.dishes.map(async (_dish, dishIdx) => {
          try {
            await access(
              join(DISH_PHOTOS_DIR, `d${targetDayIdx + 1}-s${dishIdx}.png`),
            );
            return true;
          } catch {
            return false;
          }
        }),
      )
    : [];

  const weekDishPhotos = await Promise.all(
    week.days.map(async (day, dayIdx) =>
      Promise.all(
        day.dishes.map(async (_dish, dishIdx) => {
          try {
            await access(join(DISH_PHOTOS_DIR, `d${dayIdx + 1}-s${dishIdx}.png`));
            return true;
          } catch {
            return false;
          }
        }),
      ),
    ),
  );

  const filledDays = week.days.filter((d) =>
    d.dishes.some((x) => x.name.trim()),
  ).length;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <header className="space-y-3 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-1 text-xs tracking-widest text-muted-foreground">
          <span aria-hidden>🍱</span>
          <span>江浙家常 · 多元菜系</span>
        </div>
        <h1 className="font-display text-4xl tracking-wide text-foreground">
          家 庭 菜 单
        </h1>
        {seasonal ? (
          <p className="mx-auto max-w-2xl rounded-md bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            🌱 {seasonal}
          </p>
        ) : null}
      </header>

      {/* Smart day card — today before 13:00, otherwise tomorrow.
          Auto-rolls at midnight & 13:00 since this is a server component
          rendered on each request. */}
      <Card className="overflow-hidden border-border/70 bg-card">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/40">
          <CardTitle className="flex items-baseline gap-2">
            {showTomorrow ? (
              <Sunrise className="size-4 text-primary" />
            ) : (
              <Utensils className="size-4 text-primary" />
            )}
            <span className="font-display text-xl">
              {targetTitle} · {targetWeekdayLabel}
            </span>
          </CardTitle>
          {target ? (
            <Link
              href={`/shopping/${targetIso}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
            >
              <ClipboardList className="size-3.5" />
              {targetTitle}采购
              <ArrowRight className="size-3" />
            </Link>
          ) : null}
        </CardHeader>
        {!target ? (
          <CardContent className="pt-4 text-sm">
            <p className="text-muted-foreground">
              {showTomorrow
                ? "明天是周日 / 计划之外的日子，可休息或自由安排。"
                : "今天是周日 / 计划之外的日子，由家里自由安排。"}
            </p>
          </CardContent>
        ) : target.dishes.every((d) => !d.name.trim()) ? (
          <CardContent className="pt-4 text-sm">
            <p className="text-muted-foreground">
              {targetTitle}菜单还没生成。
              <Link
                href="/menu"
                className="ml-2 text-primary underline-offset-2 hover:underline"
              >
                去 AI 一键生成 →
              </Link>
            </p>
          </CardContent>
        ) : (
          <>
            {hasTargetTablePhoto ? (
              <Link href="/menu" className="block px-6 pt-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/photo/table/${targetIso}`}
                  alt={`${targetTitle}餐桌：${target.dishes.map((d) => d.name).filter(Boolean).join("、")}`}
                  className="aspect-[3/2] w-full rounded-md object-cover transition hover:opacity-95"
                />
              </Link>
            ) : null}
            <CardContent className="space-y-3 pt-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {targetTitle}{" "}
                {target.dishes.filter((d) => d.name.trim()).length}{" "}
                道菜 ·{" "}
                {showTomorrow
                  ? "提前确认食材是否齐备"
                  : "今日待做菜品与食材"}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {target.dishes.map((dish, i) => {
                  const dishName = dish.name.trim();
                  if (!dishName) return null;
                  const hasPhoto = targetDishPhotos[i];
                  return (
                    <div
                      key={i}
                      className="flex gap-3 overflow-hidden rounded-md border border-border/50 bg-muted/15 p-2"
                    >
                      <div className="size-16 shrink-0 overflow-hidden rounded-md bg-muted">
                        {hasPhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/photo/dish/${targetDayIdx + 1}/${i}`}
                            alt={dishName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xl text-muted-foreground/70">
                            {DISH_ICONS[i]}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 text-xs">
                        <p className="text-sm font-medium leading-snug text-foreground">
                          {DISH_ICONS[i]} {dishName}
                        </p>
                        {dish.ingredients ? (
                          <p className="mt-1 line-clamp-3 leading-relaxed text-muted-foreground">
                            {dish.ingredients}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
            <CardContent className="flex items-center justify-end border-t border-border/40 py-3 text-xs text-muted-foreground">
              <Link
                href={showTomorrow ? "/menu" : "/today"}
                className="inline-flex items-center gap-1 hover:text-primary"
              >
                {showTomorrow ? "查看一周完整菜单" : "查看食材与做法"}{" "}
                <ArrowRight className="size-3" />
              </Link>
            </CardContent>
          </>
        )}
      </Card>

      {/* Week menu detail (kept here as a secondary block — full grid) */}
      <Card className="border-border/70 bg-card">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/40">
          <CardTitle className="flex items-baseline gap-2">
            <Utensils className="size-4 text-primary" />
            <span className="font-display text-xl">
              本周菜单 · {week.days[0].date.slice(5)}–{week.days[5].date.slice(5)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {week.days.map((day, dayIdx) => {
            const dishes = day.dishes.filter((dish) => dish.name.trim());

            return (
              <section key={day.date} className="space-y-2">
                <div className="flex items-baseline justify-between gap-3 px-0.5">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-sm font-medium">{WEEKDAYS[dayIdx]}</h3>
                    <span className="text-xs text-muted-foreground">{day.date.slice(5)}</span>
                    {day.style ? (
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
                        {day.style}
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted-foreground">{dishes.length} 道菜</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {day.dishes.map((dish, dishIdx) => {
                    const hasDishPhoto = weekDishPhotos[dayIdx][dishIdx];
                    const dishName = dish.name.trim();

                    return (
                      <div
                        key={`${day.date}-${dishIdx}`}
                        className="overflow-hidden rounded-lg border border-border/60 bg-muted/20"
                      >
                        {dishName ? (
                          hasDishPhoto ? (
                            <div className="px-3 pt-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`/api/photo/dish/${dayIdx + 1}/${dishIdx}`}
                                alt={dishName}
                                className="aspect-[4/3] w-full rounded-md object-cover"
                              />
                            </div>
                          ) : (
                            <div className="flex aspect-[4/3] items-center justify-center bg-muted text-3xl text-muted-foreground/70">
                              {DISH_ICONS[dishIdx]}
                            </div>
                          )
                        ) : (
                          <div className="flex aspect-[4/3] items-center justify-center bg-muted text-xs text-muted-foreground">
                            待补充
                          </div>
                        )}
                        <div className="space-y-1 px-3 py-3">
                          <div className="text-[11px] tracking-wide text-muted-foreground">
                            {DISH_ICONS[dishIdx]} {day.dishes[dishIdx] ? ["主荤", "副荤", "蔬菜", "凉菜", "汤"][dishIdx] : "菜品"}
                          </div>
                          <div className="line-clamp-2 text-base leading-snug text-foreground">
                            {dishName || "待补充"}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </CardContent>
        <CardContent className="flex flex-wrap items-center gap-3 border-t border-border/40 py-3 text-xs text-muted-foreground">
          <Link
            href="/menu"
            className="inline-flex items-center gap-1 hover:text-primary"
          >
            进入菜单详情 <ArrowRight className="size-3" />
          </Link>
        </CardContent>
      </Card>

      <footer className="text-center text-xs text-muted-foreground/70">
        <p>每周日 09:00 自动出下周菜单 · 共 {filledDays} / {week.days.length} 天已编排</p>
      </footer>
    </div>
  );
}
