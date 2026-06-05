import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MenuEditor } from "@/components/menu-editor";
import { getOrCreateWeek, mondayOf } from "@/lib/db";
import { describeSeasonal } from "@/lib/seasonal";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const monday = mondayOf();
  const week = await getOrCreateWeek(monday);
  const seasonal = describeSeasonal(monday);

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-primary"
      >
        <ChevronLeft className="size-4" />
        返回首页
      </Link>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-display text-3xl tracking-wide">本周菜单</h3>
          <p className="text-sm text-muted-foreground">
            {week.days[0].date} – {week.days[5].date} · 周一至周五 + 周日 · 每天 5 道菜
          </p>
          <p className="text-xs text-muted-foreground/80">
            默认以江浙家常为主，每周可适度融合 1-2 天川菜、徽菜或地中海风味
          </p>
          {seasonal ? (
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground/90">
              🌱 {seasonal}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {week.auto_generated ? (
            <Badge className="text-xs">🤖 AI 自动生成</Badge>
          ) : null}
          <span className="text-xs text-muted-foreground/80">
            🕘 周六 09:00 自动生成
          </span>
        </div>
      </div>

      <MenuEditor
        weekId={week.id}
        weekStart={week.week_start}
        initialDays={week.days}
      />
    </div>
  );
}
