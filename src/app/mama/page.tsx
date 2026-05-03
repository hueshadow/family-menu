import { Badge } from "@/components/ui/badge";
import { MenuEditor } from "@/components/menu-editor";
import { getOrCreateWeek, mondayOf } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MamaHome() {
  const monday = mondayOf();
  const week = await getOrCreateWeek(monday);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-semibold">本周菜单</h3>
          <p className="text-sm text-muted-foreground">
            {week.days[0].date} – {week.days[5].date} · 周一至周六 · 每天 4 道菜
          </p>
        </div>
        <Badge variant="outline">手动录入 (M2)</Badge>
      </div>

      <MenuEditor
        weekId={week.id}
        weekStart={week.week_start}
        initialDays={week.days}
      />
    </div>
  );
}
