// =========================================================================
// POST /api/generate — 手动触发周菜单生成（由前端 "AI 一键生成" 调用）
// 触发 Cloudflare Workflow，返回 instance id 供轮询。
// =========================================================================

import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function POST(req: Request) {
  let weekStart: string;
  try {
    const body = (await req.json()) as { weekStart?: string };
    weekStart = body.weekStart ?? "";
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json({ error: "invalid weekStart format — expected YYYY-MM-DD" }, { status: 400 });
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const workflow = (env as unknown as CloudflareEnv).WEEKLY_GENERATION;

    if (!workflow) {
      return NextResponse.json({ error: "Workflow binding not available" }, { status: 500 });
    }

    const instance = await workflow.create({
      params: {
        weekStart,
        trigger: "manual",
      },
    });

    // Poll the initial status
    const status = await instance.status();

    return NextResponse.json({
      id: instance.id,
      status: status.status,
    });
  } catch (e) {
    console.error("[api/generate] workflow trigger failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Workflow trigger failed" },
      { status: 500 },
    );
  }
}
