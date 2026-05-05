"use client";

import { useTransition } from "react";
import { Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ShareButtonProps {
  text: string | (() => string);
  title?: string;
  label?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "ghost" | "secondary";
}

export function ShareButton({
  text,
  title = "分享",
  label = "分享至微信",
  size = "default",
  variant = "outline",
}: ShareButtonProps) {
  const [pending, start] = useTransition();

  const onClick = () => {
    start(async () => {
      const content = typeof text === "function" ? text() : text;
      if (!content?.trim()) {
        toast.error("没有可分享的内容");
        return;
      }
      try {
        if (typeof navigator !== "undefined" && navigator.share) {
          try {
            await navigator.share({ text: content, title });
            return; // user picked an app or aborted; either way we're done
          } catch (e) {
            if ((e as DOMException)?.name === "AbortError") return;
            // fall through to clipboard
          }
        }
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(content);
          toast.success("已复制到剪贴板", {
            description: "打开微信，长按对话框 → 粘贴",
          });
          return;
        }
        toast.error("当前浏览器不支持分享");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "分享失败");
      }
    });
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="mr-1 size-4 animate-spin" />
      ) : (
        <Share2 className="mr-1 size-4" />
      )}
      {label}
    </Button>
  );
}
