"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

interface DownloadCardImageButtonProps {
  targetId: string;
  filename: string;
  label?: string;
  scale?: number;
}

const HIDDEN_EXPORT_SELECTOR = "[data-image-export-hidden]";
const DOWNLOAD_FRAME_NAME = "card-image-download-frame";

export function DownloadCardImageButton({
  targetId,
  filename,
  label = "导出图片",
  scale = 3,
}: DownloadCardImageButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setPending(true);
    setError(null);

    try {
      const target = document.getElementById(targetId);
      if (!target) {
        throw new Error("没有找到要下载的卡片");
      }

      const exportData = createCardExportData(target, scale);
      submitDownloadForm(exportData, filename);
      setTimeout(() => setPending(false), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPending(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5 hover:text-primary disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Download className="size-3.5" />
        )}
        {pending ? "生成中..." : label}
      </button>
      {error ? (
        <span className="max-w-48 text-right text-[10px] text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}

interface CardExportData {
  html: string;
  width: number;
  height: number;
  scale: number;
  backgroundColor: string;
  origin: string;
}

function createCardExportData(
  source: HTMLElement,
  scale: number,
): CardExportData {
  const rect = source.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);
  const pixelRatio = Math.max(2, Math.min(scale, 4));
  const backgroundColor = getComputedStyle(document.body).backgroundColor || "#fff";

  const clone = source.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(HIDDEN_EXPORT_SELECTOR).forEach((node) => node.remove());
  inlineComputedStyles(source, clone);

  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.margin = "0";
  clone.style.transform = "none";

  const serialized = new XMLSerializer().serializeToString(clone);

  return {
    html: serialized,
    width,
    height,
    scale: pixelRatio,
    backgroundColor,
    origin: window.location.origin,
  };
}

function submitDownloadForm(
  data: CardExportData,
  filename: string,
) {
  const form = document.createElement("form");
  ensureDownloadFrame();
  form.method = "POST";
  form.action = "/api/photo/card";
  form.target = DOWNLOAD_FRAME_NAME;
  form.style.display = "none";

  Object.entries({ ...data, filename }).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = String(value);
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
  setTimeout(() => form.remove(), 1000);
}

function ensureDownloadFrame() {
  const existing = document.querySelector<HTMLIFrameElement>(
    `iframe[name="${DOWNLOAD_FRAME_NAME}"]`,
  );
  if (existing) return existing;

  const iframe = document.createElement("iframe");
  iframe.name = DOWNLOAD_FRAME_NAME;
  iframe.style.display = "none";
  document.body.appendChild(iframe);
  return iframe;
}

function inlineComputedStyles(source: Element, clone: Element) {
  copyComputedStyle(source, clone as HTMLElement);

  const sourceChildren = Array.from(source.children);
  const cloneChildren = Array.from(clone.children);

  for (let i = 0; i < cloneChildren.length; i += 1) {
    const cloneChild = cloneChildren[i];
    if (cloneChild.matches(HIDDEN_EXPORT_SELECTOR)) continue;

    const sourceChild = sourceChildren[i];
    if (sourceChild) {
      inlineComputedStyles(sourceChild, cloneChild);
    }
  }
}

function copyComputedStyle(source: Element, clone: HTMLElement) {
  const computed = window.getComputedStyle(source);
  for (const property of computed) {
    clone.style.setProperty(
      property,
      computed.getPropertyValue(property),
      computed.getPropertyPriority(property),
    );
  }
}
