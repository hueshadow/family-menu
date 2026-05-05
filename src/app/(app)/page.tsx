import { access } from "node:fs/promises";
import { join } from "node:path";
import Link from "next/link";
import { ArrowRight, BookOpen, Clipboard, ClipboardList, LineChart, Users, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getOrCreateWeek,
  getShoppingListByWeekStart,
  isoDate,
  mondayOf,
} from "@/lib/db";
import { DISH_PHOTOS_DIR } from "@/lib/dish-photos";
import { describeSeasonal } from "@/lib/seasonal";
import { DISH_ICONS, WEEKDAYS } from "@/lib/shared";
import { TABLE_PHOTOS_DIR } from "@/lib/table-photo";

export const dynamic = "force-dynamic";

export default async function Home() {
  const monday = mondayOf();
  const week = await getOrCreateWeek(monday);
  const list = await getShoppingListByWeekStart(monday);
  const seasonal = describeSeasonal();

  const todayIso = isoDate(new Date());
  const today = week.days.find((d) => d.date === todayIso) ?? null;
  const todayLabel = new Date().toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  let hasTodayTablePhoto = false;
  if (today) {
    try {
      await access(join(TABLE_PHOTOS_DIR, `${todayIso}.png`));
      hasTodayTablePhoto = true;
    } catch {
      hasTodayTablePhoto = false;
    }
  }

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

  const filledDays = week.days.filter((d) => d.dishes.some((x) => x.name.trim())).length;
  const totalItems = list?.items.length ?? 0;
  const checkedItems = list?.items.filter((i) => i.checked).length ?? 0;
  const purchasePct = totalItems
    ? Math.round((checkedItems / totalItems) * 100)
    : 0;

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

      {/* Today */}
      <Card className="overflow-hidden border-border/70 bg-card">
        <CardHeader className="border-b border-border/40">
          <CardTitle className="flex items-baseline gap-2 text-lg">
            <Utensils className="size-4 text-primary" />
            <span className="font-display text-xl">今日 · {todayLabel}</span>
          </CardTitle>
        </CardHeader>
        {!today ? (
          <CardContent className="pt-4 text-sm">
            <p className="text-muted-foreground">
              今天是周日 / 计划之外的日子，由家里自由安排。
            </p>
          </CardContent>
        ) : today.dishes.every((d) => !d.name.trim()) ? (
          <CardContent className="pt-4 text-sm">
            <p className="text-muted-foreground">
              本周菜单还没生成。
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
            {hasTodayTablePhoto ? (
              <Link href="/today" className="block px-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/photo/table/${todayIso}`}
                  alt={`今日餐桌：${today.dishes.map((d) => d.name).filter(Boolean).join("、")}`}
                  className="aspect-[3/2] w-full rounded-md object-cover transition hover:opacity-95"
                />
              </Link>
            ) : (
              <CardContent className="pt-4 text-sm">
                <ul className="space-y-1.5">
                  {today.dishes.map((dish, i) =>
                    dish.name.trim() ? (
                        <li key={i} className="flex items-baseline gap-2">
                          <span className="text-base">{DISH_ICONS[i]}</span>
                          <span className="text-base">{dish.name}</span>
                        </li>
                    ) : null,
                  )}
                </ul>
              </CardContent>
            )}
            <CardContent className="border-t border-border/40 py-3 text-muted-foreground">
              <p className="mb-2 text-base leading-relaxed">
                {today.dishes
                  .map((d, i) =>
                    d.name.trim() ? `${DISH_ICONS[i]} ${d.name}` : null,
                  )
                  .filter(Boolean)
                  .join("　·　")}
              </p>
              <Link
                href="/today"
                className="inline-flex items-center gap-1 hover:text-primary"
              >
                查看食材与做法 <ArrowRight className="size-3" />
              </Link>
            </CardContent>
          </>
        )}
      </Card>

      {/* Week menu summary */}
      <Card className="border-border/70 bg-card">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/40">
          <CardTitle className="flex items-baseline gap-2">
            <BookOpen className="size-4 text-primary" />
            <span className="font-display text-xl">
              本周菜单 · {week.days[0].date.slice(5)}–{week.days[5].date.slice(5)}
            </span>
          </CardTitle>
          <Link
            href="/shopping"
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
          >
            <ClipboardList className="size-3.5" />
            采购清单
            <ArrowRight className="size-3" />
          </Link>
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

      {/* Shopping summary */}
      <Card className="border-border/70 bg-card">
        <CardHeader className="flex flex-row items-baseline justify-between border-b border-border/40">
          <CardTitle className="flex items-baseline gap-2">
            <ClipboardList className="size-4 text-primary" />
            <span className="font-display text-xl">采购清单</span>
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {checkedItems} / {totalItems}
          </span>
        </CardHeader>
        <CardContent className="space-y-3 pt-4 text-sm">
          {totalItems === 0 ? (
            <p className="text-muted-foreground">
              本周菜单尚未确认，等菜单生成后会自动派生采购清单。
            </p>
          ) : (
            <>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${purchasePct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                已购 {purchasePct}% · 剩 {totalItems - checkedItems} 项待购
              </p>
            </>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/shopping"
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              勾选已购 <ArrowRight className="size-3" />
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Quick links */}
      <section className="grid gap-3 sm:grid-cols-3">
        <QuickLink href="/family" icon={<Users className="size-4" />} title="家庭档案" desc="5 名成员处方 · 体检报告" />
        <QuickLink href="/trend" icon={<LineChart className="size-4" />} title="营养趋势" desc="近期 7 项指标" />
        <QuickLink href="/history" icon={<Clipboard className="size-4" />} title="历史菜单" desc="过往 50 周存档" />
      </section>

      <footer className="text-center text-xs text-muted-foreground/70">
        <p>每周日 09:00 自动出下周菜单 · 共 {filledDays} / {week.days.length} 天已编排</p>
      </footer>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  desc,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full border-border/70 bg-card transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md">
        <CardContent className="flex items-center gap-3 p-4 text-sm">
          <span className="text-primary">{icon}</span>
          <div>
            <div className="font-medium">{title}</div>
            <div className="text-xs text-muted-foreground">{desc}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
