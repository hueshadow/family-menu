import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrCreateWeek, isoDate, mondayOf } from "@/lib/db";

export const dynamic = "force-dynamic";

const DISH_LABELS = ["主荤", "副荤", "蔬菜", "汤 / 半荤"];
const DISH_ICONS = ["🐠", "🍳", "🥬", "🍲"];

export default async function AyiHome() {
  const monday = mondayOf();
  const week = await getOrCreateWeek(monday);
  const todayIso = isoDate(new Date());
  const today = week.days.find((d) => d.date === todayIso) ?? null;

  const todayLabel = new Date().toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  if (!today) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border p-4">
          <h3 className="text-xl font-semibold">{todayLabel}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            今天是周日 / 计划之外的日子，由家里自由安排。
          </p>
        </div>
      </div>
    );
  }

  const filled = today.dishes.filter((d) => d.name.trim()).length;

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4">
        <h3 className="text-xl font-semibold">{todayLabel}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {filled === 4
            ? "今日 4 道菜已就绪"
            : `已安排 ${filled} / 4 道菜，请妈妈补全`}
        </p>
      </div>

      <div className="space-y-3">
        {today.dishes.map((dish, i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle className="flex items-baseline gap-2 text-base">
                <span>{DISH_ICONS[i]}</span>
                <span>{dish.name || `（${DISH_LABELS[i]}：未填写）`}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {dish.ingredients ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">食材</p>
                  <p className="leading-relaxed">{dish.ingredients}</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">食材待补充</p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                做法说明将在 M3 由 AI 自动生成（含老人/宝宝注意事项）
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
