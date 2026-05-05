"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

interface DownloadImageButtonProps {
  url: string;
  filename: string;
  label?: string;
  variant?: "default" | "outline";
}

export function DownloadImageButton({
  url,
  filename,
  label = "导出图片",
  variant = "outline",
}: DownloadImageButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`${res.status}: ${txt.slice(0, 80)}`);
      }
      const blob = await res.blob();
      const obj = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = obj;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(obj), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  };

  const base =
    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition disabled:opacity-60";
  const styles =
    variant === "default"
      ? `${base} bg-primary text-primary-foreground hover:bg-primary/90`
      : `${base} border border-border/60 bg-card text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary`;

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={styles}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Download className="size-3.5" />
        )}
        {pending ? "生成中…" : label}
      </button>
      {error ? (
        <span className="text-[10px] text-destructive">{error}</span>
      ) : null}
    </div>
  );
}
