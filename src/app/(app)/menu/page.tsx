import { Badge } from "@/components/ui/badge";
import { MenuEditor } from "@/components/menu-editor";
import { getOrCreateWeek, mondayOf } from "@/lib/db";
import { describeSeasonal } from "@/lib/seasonal";

export const dynamic = "force-dynamic";

export default async function MamaHome() {
  const monday = mondayOf();
  const week = await getOrCreateWeek(monday);
  const seasonal = describeSeasonal(monday);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-display text-3xl tracking-wide">本周菜单</h3>
          <p className="text-sm text-muted-foreground">
            {week.days[0].date} – {week.days[5].date} · 周一至周六 · 每天 5 道菜
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
            🕘 周日 09:00 自动生成
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
