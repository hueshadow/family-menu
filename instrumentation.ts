// =========================================================================
// 定时任务已迁至 Cloudflare Cron Triggers + Workflows。
// 进程内 scheduler (setInterval) 已废弃，不再在 Node.js 进程里调度。
// workers 上此文件不注册任何 long-running side effects。
// =========================================================================
export async function register(): Promise<void> {
  console.log("[instrumentation] scheduler disabled — using Cloudflare Cron Triggers + Workflows");
}
