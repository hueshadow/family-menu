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
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-2xl font-semibold">本周菜单</h3>
          <p className="text-sm text-muted-foreground">
            {week.days[0].date} – {week.days[5].date} · 周一至周六 · 每天 5 道菜
          </p>
          {seasonal ? (
            <p className="mt-1 text-xs text-muted-foreground">
              🌱 {seasonal}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          {week.auto_generated ? (
            <Badge>🤖 AI 自动生成</Badge>
          ) : null}
          <span className="text-xs text-muted-foreground">
            🕘 自动生成：周日 22:00（如本周空缺）
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
