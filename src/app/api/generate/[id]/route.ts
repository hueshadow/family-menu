// =========================================================================
// GET /api/generate/[id] — 查询 Workflow 实例状态
// 前端轮询此接口直到 status === "completed" 或 "failed"
// =========================================================================

import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id || id.length < 4) {
    return NextResponse.json({ error: "invalid instance id" }, { status: 400 });
  }

  try {
    const { env } = await getCloudflareContext({ async: true });
    const workflow = (env as unknown as CloudflareEnv).WEEKLY_GENERATION;

    if (!workflow) {
      return NextResponse.json({ error: "Workflow binding not available" }, { status: 500 });
    }

    const instance = await workflow.get(id);
    const status = await instance.status();

    return NextResponse.json({
      id: instance.id,
      status: status.status,
      output: status.output ?? null,
      error: status.error ?? null,
    });
  } catch (e) {
    console.error(`[api/generate/${id}] status check failed:`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Status check failed" },
      { status: 500 },
    );
  }
}
