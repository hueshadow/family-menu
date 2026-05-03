"use client";

import { useState, useTransition } from "react";
import { ChefHat, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateRecipeAction } from "@/app/actions";

export function RecipeBlock({
  dishName,
  ingredients,
  initialSteps,
  initialTips,
}: {
  dishName: string;
  ingredients: string;
  initialSteps?: string;
  initialTips?: string;
}) {
  const [steps, setSteps] = useState<string | null>(initialSteps ?? null);
  const [tips, setTips] = useState<string | undefined>(initialTips);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onLoad = () => {
    setError(null);
    start(async () => {
      const res = await generateRecipeAction(dishName, ingredients);
      if (res.ok) {
        setSteps(res.steps);
        setTips(res.tips);
      } else {
        setError(res.error);
      }
    });
  };

  if (steps) {
    return (
      <div className="mt-3 space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
        <p className="text-xs font-medium text-muted-foreground">做法</p>
        <pre className="whitespace-pre-wrap font-sans leading-relaxed">{steps}</pre>
        {tips ? (
          <>
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              老人 / 宝宝注意
            </p>
            <p className="leading-relaxed">{tips}</p>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-3">
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        onClick={onLoad}
        disabled={pending || !dishName.trim()}
      >
        {pending ? (
          <Loader2 className="mr-1 size-3 animate-spin" />
        ) : (
          <ChefHat className="mr-1 size-3" />
        )}
        {pending ? "AI 写做法中…" : "查看做法"}
      </Button>
    </div>
  );
}
