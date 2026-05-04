"use client";

import { useState, useTransition } from "react";
import { BarChart3, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeNutritionAction,
  generateWeekAction,
  getCandidatesAction,
  saveWeekAction,
} from "@/app/actions";
import type { NutritionAnalysis } from "@/lib/menu-gen";
import { DISH_SLOTS, WEEKDAYS, type DayInput } from "@/lib/shared";

type Candidate = { name: string; ingredients: string; reason?: string };

const LEVEL_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  充足: "default",
  基本满足: "secondary",
  略不足: "outline",
  明显不足: "destructive",
  偏高: "destructive",
};

function LevelBadge({ level }: { level: string }) {
  const variant = LEVEL_VARIANT[level] ?? "outline";
  return <Badge variant={variant}>{level}</Badge>;
}

export function MenuEditor({
  weekId,
  weekStart,
  initialDays,
}: {
  weekId: string;
  weekStart: string;
  initialDays: DayInput[];
}) {
  const [days, setDays] = useState<DayInput[]>(initialDays);
  const [pendingSave, startSave] = useTransition();
  const [pendingGenerate, startGenerate] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [replacing, setReplacing] = useState<{
    dayIdx: number;
    dishIdx: number;
  } | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [pendingCandidates, startCandidates] = useTransition();

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysis, setAnalysis] = useState<NutritionAnalysis | null>(null);
  const [pendingAnalysis, startAnalysis] = useTransition();

  const update = (
    di: number,
    dishi: number,
    field: "name" | "ingredients",
    v: string,
  ) => {
    setDays((prev) => {
      const next = prev.map((d) => ({
        ...d,
        dishes: d.dishes.map((x) => ({ ...x })),
      }));
      next[di].dishes[dishi][field] = v;
      return next;
    });
    setSaved(null);
  };

  const onSave = () => {
    setError(null);
    startSave(async () => {
      await saveWeekAction(weekId, days);
      setSaved(new Date().toLocaleTimeString("zh-CN"));
    });
  };

  const onGenerateWeek = () => {
    if (
      days.some((d) => d.dishes.some((dish) => dish.name.trim())) &&
      !window.confirm("本周已有内容，AI 将整体重写。继续吗？")
    ) {
      return;
    }
    setError(null);
    startGenerate(async () => {
      const res = await generateWeekAction(weekId, weekStart);
      if (res.ok) {
        setDays(res.days);
        setSaved(new Date().toLocaleTimeString("zh-CN"));
      } else {
        setError(res.error);
      }
    });
  };

  const openReplace = (dayIdx: number, dishIdx: number) => {
    setReplacing({ dayIdx, dishIdx });
    setCandidates(null);
    setError(null);
    startCandidates(async () => {
      const res = await getCandidatesAction({
        weekId,
        dayIdx,
        dishIdx,
        days,
      });
      if (res.ok) setCandidates(res.candidates);
      else setError(res.error);
    });
  };

  const applyCandidate = (c: Candidate) => {
    if (!replacing) return;
    update(replacing.dayIdx, replacing.dishIdx, "name", c.name);
    update(replacing.dayIdx, replacing.dishIdx, "ingredients", c.ingredients);
    setReplacing(null);
  };

  const openAnalysis = () => {
    setAnalysisOpen(true);
    setAnalysis(null);
    setError(null);
    startAnalysis(async () => {
      const res = await analyzeNutritionAction({ weekId, days });
      if (res.ok) setAnalysis(res.analysis);
      else setError(res.error);
    });
  };

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-6 flex flex-wrap items-center justify-between gap-2 border-b bg-background/95 px-6 py-3 backdrop-blur">
        <p className="text-sm text-muted-foreground">
          {error
            ? <span className="text-destructive">{error}</span>
            : saved
              ? `已保存 · ${saved}`
              : "未保存的修改会自动暂存在表单内"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={openAnalysis}
            disabled={pendingAnalysis || pendingGenerate}
          >
            <BarChart3 className="mr-1 size-4" />
            营养分析
          </Button>
          <Button
            variant="outline"
            onClick={onGenerateWeek}
            disabled={pendingGenerate || pendingSave}
          >
            {pendingGenerate ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1 size-4" />
            )}
            {pendingGenerate ? "AI 生成中（约 30 秒）" : "AI 一键生成本周"}
          </Button>
          <Button onClick={onSave} disabled={pendingSave || pendingGenerate}>
            {pendingSave ? "保存中…" : "保存并生成采购清单"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {days.map((day, di) => (
          <Card key={day.date} className="border-border/70 bg-card">
            <CardHeader className="flex-row items-baseline justify-between border-b border-border/40 pb-3">
              <CardTitle className="font-display text-xl tracking-wide">
                {WEEKDAYS[di]}
              </CardTitle>
              <span className="font-mono text-xs text-muted-foreground">
                {day.date.slice(5)}
              </span>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {day.dishes.map((dish, dishi) => (
                <div key={dishi} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium tracking-wider text-muted-foreground">
                      {DISH_SLOTS[dishi]}
                    </label>
                    {dish.name.trim() ? (
                      <button
                        type="button"
                        onClick={() => openReplace(di, dishi)}
                        className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-primary"
                      >
                        <Wand2 className="size-3" /> 换一道
                      </button>
                    ) : null}
                  </div>
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

      <Dialog open={analysisOpen} onOpenChange={setAnalysisOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>本周营养分析</DialogTitle>
            <DialogDescription>
              AI 综合本周菜单 + 5 人画像 + 体检处方给出评估
            </DialogDescription>
          </DialogHeader>
          {pendingAnalysis && !analysis ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              正在分析中…
            </div>
          ) : analysis ? (
            <div className="space-y-5 text-sm">
              <p className="rounded-md border bg-muted/30 p-3">
                💬 {analysis.overall}
              </p>
              <section>
                <h5 className="mb-2 text-sm font-semibold">7 项核心指标</h5>
                <div className="grid gap-2 sm:grid-cols-2">
                  {analysis.metrics.map((m) => (
                    <div
                      key={m.name}
                      className="rounded-md border p-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{m.name}</span>
                        <LevelBadge level={m.level} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {m.note}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <h5 className="mb-2 text-sm font-semibold">每位成员</h5>
                <ul className="space-y-1.5">
                  {analysis.perMember.map((p) => (
                    <li key={p.name} className="flex gap-2">
                      <span className="font-medium">{p.name}：</span>
                      <span className="flex-1 text-muted-foreground">
                        {p.comment}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h5 className="mb-2 text-sm font-semibold">改进建议</h5>
                <ul className="list-inside list-disc space-y-1">
                  {analysis.improvements.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </section>
            </div>
          ) : (
            <p className="py-4 text-sm text-destructive">{error}</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!replacing}
        onOpenChange={(open) => !open && setReplacing(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              换一道{replacing ? DISH_SLOTS[replacing.dishIdx] : ""}
            </DialogTitle>
            <DialogDescription>
              AI 根据家庭画像、苏州本帮风格、当日其它菜及本周历史给出 3 个候选
            </DialogDescription>
          </DialogHeader>
          {pendingCandidates && !candidates ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              正在思考候选…
            </div>
          ) : candidates ? (
            <div className="space-y-2">
              {candidates.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applyCandidate(c)}
                  className="block w-full rounded-md border p-3 text-left transition hover:border-foreground/40 hover:bg-muted/50"
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {c.ingredients}
                  </div>
                  {c.reason ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      💡 {c.reason}
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          ) : (
            <p className="py-4 text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReplacing(null)}>
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
