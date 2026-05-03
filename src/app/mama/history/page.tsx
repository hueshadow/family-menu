import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listWeeksAction } from "@/app/actions";
import { isoDate, mondayOf } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  reviewing: "审核中",
  locked: "已锁定",
  archived: "归档",
};

export default async function HistoryPage() {
  const weeks = await listWeeksAction();
  const currentWeekStart = isoDate(mondayOf());

  if (weeks.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-2xl font-semibold">历史菜单</h3>
        <p className="text-sm text-muted-foreground">还没有任何周菜单。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold">历史菜单</h3>
        <p className="text-sm text-muted-foreground">
          {weeks.length} 周菜单存档（最近 50 周）
        </p>
      </div>

      <div className="space-y-3">
        {weeks.map((w) => {
          const isCurrent = w.week_start === currentWeekStart;
          const dishCount = w.dishes.length;
          return (
            <Card key={w.id}>
              <CardHeader className="flex-row items-baseline justify-between">
                <CardTitle className="flex items-baseline gap-2 text-base">
                  <span>{w.week_start}</span>
                  {isCurrent ? <Badge variant="secondary">本周</Badge> : null}
                  <Badge variant="outline">
                    {STATUS_LABELS[w.status] ?? w.status}
                  </Badge>
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {dishCount} 道菜预览
                </span>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {w.dishes.length ? (
                  <p className="leading-relaxed">{w.dishes.join(" · ")}</p>
                ) : (
                  <p className="italic">本周菜单为空</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
