"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, FileText, Loader2, ScanLine, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { processReportAction, type ReportFileSummary } from "@/app/actions";
import type { MemberRow } from "@/lib/shared";

export function ReportRow({
  file,
  members,
}: {
  file: ReportFileSummary;
  members: MemberRow[];
}) {
  const guessedMember = file.guessedRole
    ? members.find((m) => m.role === file.guessedRole)
    : null;
  const [memberId, setMemberId] = useState<string>(guessedMember?.id ?? "");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<
    | null
    | {
        ok: true;
        abnormalCount: number;
        ocrUsed: boolean;
        profileTags: string[];
      }
    | { ok: false; error: string }
  >(null);

  const onProcess = () => {
    if (!memberId) return;
    setResult(null);
    start(async () => {
      const res = await processReportAction({
        memberId,
        filename: file.filename,
      });
      setResult(res);
    });
  };

  const sizeLabel =
    file.size > 1024 * 1024
      ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
      : `${(file.size / 1024).toFixed(0)} KB`;

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-2 min-w-0">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm">{file.filename}</span>
        {file.alreadyProcessed ? (
          <CheckCircle2 className="size-4 shrink-0 text-green-600" />
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        <span>
          {file.pages} 页 · {sizeLabel}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={memberId}
          onValueChange={(v) => setMemberId(v ?? "")}
          disabled={pending}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="选择成员" />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={onProcess}
          disabled={!memberId || pending}
        >
          {pending ? (
            <Loader2 className="mr-1 size-3 animate-spin" />
          ) : (
            <Sparkles className="mr-1 size-3" />
          )}
          {pending
            ? file.pages > 1 && file.size > 1_000_000
              ? "OCR 中…"
              : "解析中…"
            : file.alreadyProcessed
              ? "重新解析"
              : "AI 解析"}
        </Button>
      </div>
      {result ? (
        <div className="basis-full text-xs">
          {result.ok ? (
            <div className="flex items-center gap-2 text-green-700">
              {result.ocrUsed ? <ScanLine className="size-3" /> : null}
              <span>
                解析完成 · {result.abnormalCount} 项异常 · 处方标签：
                {result.profileTags.join("、") || "（无）"}
              </span>
            </div>
          ) : (
            <span className="text-destructive">{result.error}</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
