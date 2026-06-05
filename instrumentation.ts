// =========================================================================
// 在长驻 Node.js 进程（next start / next dev）里启动进程内调度器。
// Cloudflare Workers 运行时（NEXT_RUNTIME !== "nodejs"）下保持禁用——
// 那里由 Cron Triggers + Workflows 调度，避免双重生成。
// =========================================================================
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    console.log(
      "[instrumentation] non-node runtime — scheduler disabled (Cloudflare Cron owns scheduling)",
    );
    return;
  }
  const { startScheduler } = await import("@/lib/scheduler");
  startScheduler();
}
