"use client";

import { useState, useTransition } from "react";
import { Loader2, Replace } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getSubstitutesAction } from "@/app/actions";

type Sub = { name: string; howto: string; tradeoff?: string };

export function SubstituteHelper({ dishName }: { dishName: string }) {
  const [open, setOpen] = useState(false);
  const [ingredient, setIngredient] = useState("");
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onLook = () => {
    if (!ingredient.trim()) return;
    setSubs(null);
    setError(null);
    start(async () => {
      const res = await getSubstitutesAction({
        ingredient: ingredient.trim(),
        dishName,
      });
      if (res.ok) setSubs(res.substitutes);
      else setError(res.error);
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs"
        onClick={() => setOpen(true)}
      >
        <Replace className="mr-1 size-3" />
        食材没了？
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>替代食材</DialogTitle>
            <DialogDescription>
              做「{dishName}」时缺什么食材？AI 用家里常备的给你 3 个替代
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              placeholder="如：鲈鱼、豆腐、香菇"
              value={ingredient}
              onChange={(e) => setIngredient(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onLook()}
            />
            <Button onClick={onLook} disabled={pending || !ingredient.trim()}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "找替代"
              )}
            </Button>
          </div>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          {subs ? (
            <div className="space-y-2">
              {subs.map((s, i) => (
                <div key={i} className="rounded-md border p-3 text-sm">
                  <div className="font-medium">{s.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    👉 {s.howto}
                  </div>
                  {s.tradeoff ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      ⚖️ {s.tradeoff}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
