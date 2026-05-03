"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveWeekAction } from "@/app/actions";
import type { DayInput } from "@/lib/shared";

const DISH_LABELS = ["主荤", "副荤", "蔬菜", "汤 / 半荤"];
const WEEKDAYS = ["周一", "周二", "周三", "周四", "周五", "周六"];

export function MenuEditor({
  weekId,
  initialDays,
}: {
  weekId: string;
  initialDays: DayInput[];
}) {
  const [days, setDays] = useState<DayInput[]>(initialDays);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);

  const update = (di: number, dishi: number, field: "name" | "ingredients", v: string) => {
    setDays((prev) => {
      const next = prev.map((d) => ({ ...d, dishes: d.dishes.map((x) => ({ ...x })) }));
      next[di].dishes[dishi][field] = v;
      return next;
    });
    setSaved(null);
  };

  const onSave = () => {
    startTransition(async () => {
      await saveWeekAction(weekId, days);
      setSaved(new Date().toLocaleTimeString("zh-CN"));
    });
  };

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-6 flex items-center justify-between border-b bg-background/95 px-6 py-3 backdrop-blur">
        <p className="text-sm text-muted-foreground">
          {saved ? `已保存 · ${saved}` : "未保存的修改会自动暂存在表单内"}
        </p>
        <Button onClick={onSave} disabled={pending}>
          {pending ? "保存中…" : "保存并生成采购清单"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {days.map((day, di) => (
          <Card key={day.date}>
            <CardHeader className="flex-row items-baseline justify-between">
              <CardTitle className="text-base">{WEEKDAYS[di]}</CardTitle>
              <span className="text-xs text-muted-foreground">
                {day.date.slice(5)}
              </span>
            </CardHeader>
            <CardContent className="space-y-3">
              {day.dishes.map((dish, dishi) => (
                <div key={dishi} className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    {DISH_LABELS[dishi]}
                  </label>
                  <Input
                    placeholder="菜名"
                    value={dish.name}
                    onChange={(e) => update(di, dishi, "name", e.target.value)}
                  />
                  <Textarea
                    placeholder="食材，逗号分隔。如：鲈鱼 1 条, 葱姜适量, 蒸鱼豉油"
                    value={dish.ingredients}
                    onChange={(e) =>
                      update(di, dishi, "ingredients", e.target.value)
                    }
                    className="min-h-16 text-xs"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
