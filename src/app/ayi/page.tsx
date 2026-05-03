import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecipeBlock } from "@/components/recipe-block";
import { SubstituteHelper } from "@/components/substitute-helper";
import {
  getOrCreateWeek,
  getRecipesByNames,
  isoDate,
  mondayOf,
} from "@/lib/db";
import { DISH_ICONS, DISH_SLOTS } from "@/lib/shared";

export const dynamic = "force-dynamic";

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
  const total = today.dishes.length;
  const dishNames = today.dishes
    .map((d) => d.name)
    .filter((n) => n.trim().length > 0);
  const recipes = await getRecipesByNames(dishNames);
  const recipeMap = new Map(recipes.map((r) => [r.name, r]));

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4">
        <h3 className="text-xl font-semibold">{todayLabel}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {filled === total
            ? `今日 ${total} 道菜已就绪`
            : `已安排 ${filled} / ${total} 道菜，请妈妈补全`}
        </p>
      </div>

      <div className="space-y-3">
        {today.dishes.map((dish, i) => {
          const recipe = recipeMap.get(dish.name);
          return (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="flex items-baseline gap-2 text-base">
                  <span>{DISH_ICONS[i]}</span>
                  <span>
                    {dish.name || `（${DISH_SLOTS[i]}：未填写）`}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                {dish.ingredients ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      食材
                    </p>
                    <p className="leading-relaxed">{dish.ingredients}</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">食材待补充</p>
                )}
                {dish.name.trim() ? (
                  <>
                    <RecipeBlock
                      dishName={dish.name}
                      ingredients={dish.ingredients}
                      initialSteps={recipe?.steps}
                      initialTips={recipe?.notes ?? undefined}
                    />
                    <div className="mt-2">
                      <SubstituteHelper dishName={dish.name} />
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
