import "server-only";

// =========================================================================
// 进程内调度器已废弃。
// 定时任务已迁至 Cloudflare Cron Triggers + Workflows (src/workflows/)。
// 此文件保留导出以兼容旧 import 引用，实际不启动任何定时器。
// =========================================================================

declare global {
  // eslint-disable-next-line no-var
  var __familyMenuScheduler: { started: boolean; lastRun: string | null } | undefined;
}

export function startScheduler(): void {
  console.log("[scheduler] disabled — using Cloudflare Cron Triggers + Workflows");
  globalThis.__familyMenuScheduler = { started: true, lastRun: null };
}

export function getSchedulerState(): { started: boolean; lastRun: string | null } {
  return (
    globalThis.__familyMenuScheduler ?? { started: false, lastRun: null }
  );
}
