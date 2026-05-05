import Link from "next/link";
import { ArrowRight, BookOpen, Clipboard, ClipboardList, FileHeart, LineChart, Sparkles, Users, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShareButton } from "@/components/share-button";
import {
  getOrCreateWeek,
  getShoppingListByWeekStart,
  isoDate,
  mondayOf,
} from "@/lib/db";
import { describeSeasonal } from "@/lib/seasonal";
import { formatDayMenu, formatShoppingList, formatWeekMenu } from "@/lib/share-formatter";
import { DISH_ICONS, WEEKDAYS } from "@/lib/shared";

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
  const todayWeekdayIdx = today
    ? week.days.findIndex((d) => d.date === todayIso)
    : -1;

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
          <span>苏州本帮 · 江浙家常</span>
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
      <Card className="border-border/70 bg-card">
        <CardHeader className="flex flex-row items-baseline justify-between border-b border-border/40">
          <CardTitle className="flex items-baseline gap-2 text-lg">
            <Utensils className="size-4 text-primary" />
            <span className="font-display text-xl">今日 · {todayLabel}</span>
          </CardTitle>
          {today && today.dishes.some((d) => d.name.trim()) ? (
            <ShareButton
              text={formatDayMenu(today)}
              title="今日菜单"
              label="分享至微信"
              size="sm"
              variant="outline"
            />
          ) : null}
        </CardHeader>
        <CardContent className="space-y-2 pt-4 text-sm">
          {!today ? (
            <p className="text-muted-foreground">
              今天是周日 / 计划之外的日子，由家里自由安排。
            </p>
          ) : today.dishes.every((d) => !d.name.trim()) ? (
            <p className="text-muted-foreground">
              本周菜单还没生成。
              <Link
                href="/menu"
                className="ml-2 text-primary underline-offset-2 hover:underline"
              >
                去 AI 一键生成 →
              </Link>
            </p>
          ) : (
            <ul className="space-y-1.5">
              {today.dishes.map((dish, i) =>
                dish.name.trim() ? (
                  <li key={i} className="flex items-baseline gap-2">
                    <span className="text-base">{DISH_ICONS[i]}</span>
                    <span>{dish.name}</span>
                  </li>
                ) : null,
              )}
            </ul>
          )}
          <div className="pt-2">
            <Link
              href="/today"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
            >
              查看食材与做法 <ArrowRight className="size-3" />
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Week menu summary */}
      <Card className="border-border/70 bg-card">
        <CardHeader className="flex flex-row items-baseline justify-between border-b border-border/40">
          <CardTitle className="flex items-baseline gap-2">
            <BookOpen className="size-4 text-primary" />
            <span className="font-display text-xl">
              本周菜单 · {week.days[0].date.slice(5)}–{week.days[5].date.slice(5)}
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {week.auto_generated ? (
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="mr-1 size-3" /> AI 自动生成
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="pt-4 text-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {week.days.map((d, i) => {
              const isToday = d.date === todayIso;
              return (
                <div
                  key={d.date}
                  className={`rounded-md border p-2 ${isToday ? "border-primary/60 bg-primary/5" : "border-border/50"}`}
                >
                  <div className="text-xs font-medium">{WEEKDAYS[i]}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {d.date.slice(5)}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {d.dishes.filter((x) => x.name.trim()).length} 道菜
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ShareButton
              text={formatWeekMenu(week.days)}
              title="本周菜单"
              label="分享本周"
              size="sm"
              variant="outline"
            />
            <Link
              href="/menu"
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              编辑菜单 <ArrowRight className="size-3" />
            </Link>
          </div>
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
            {list ? (
              <ShareButton
                text={formatShoppingList(list.items, { onlyUnchecked: true })}
                title="采购清单"
                label="分享至微信"
                size="sm"
                variant="outline"
              />
            ) : null}
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
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink href="/family" icon={<Users className="size-4" />} title="家庭档案" desc="5 名成员饮食处方" />
        <QuickLink href="/reports" icon={<FileHeart className="size-4" />} title="体检报告" desc="AI 解析数字 / 扫描" />
        <QuickLink href="/trend" icon={<LineChart className="size-4" />} title="营养趋势" desc="近期 7 项指标" />
        <QuickLink href="/history" icon={<Clipboard className="size-4" />} title="历史菜单" desc="过往 50 周存档" />
      </section>

      <footer className="text-center text-xs text-muted-foreground/70">
        <p>每周日 22:00 自动出下周菜单 · 共 {filledDays} / {week.days.length} 天已编排</p>
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
