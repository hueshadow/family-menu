import "server-only";

// =========================================================================
// 进程内调度器（本地长驻 next start 进程使用）。
// 每周六 09:00 本地时间，自动生成"即将开始的下周"菜单（周一–周五 + 周日）。
// 注意：部署到 Cloudflare Workers 时必须保持禁用（见 instrumentation.ts 的
// NEXT_RUNTIME 守卫）——那里由 Cron Triggers + Workflows 负责调度，避免双重生成。
// =========================================================================

declare global {
  // eslint-disable-next-line no-var
  var __familyMenuScheduler:
    | { started: boolean; lastRun: string | null }
    | undefined;
}

const TICK_INTERVAL_MS = 5 * 60 * 1000; // 5 min

export function startScheduler(): void {
  if (globalThis.__familyMenuScheduler?.started) return;
  globalThis.__familyMenuScheduler = { started: true, lastRun: null };
  console.log("[scheduler] started · 周六 09:00 自动生成下周菜单");

  setInterval(() => {
    void tick().catch((e) => console.error("[scheduler] tick error:", e));
  }, TICK_INTERVAL_MS);

  // Boot catch-up: if the server was down during the Saturday window, backfill now.
  setTimeout(() => {
    void bootCatchUp().catch((e) =>
      console.error("[scheduler] boot catch-up error:", e),
    );
  }, 10_000);
}

export function getSchedulerState(): {
  started: boolean;
  lastRun: string | null;
} {
  return globalThis.__familyMenuScheduler ?? { started: false, lastRun: null };
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Generate the upcoming week (next Monday's week) and record the run. */
async function runFor(now: Date): Promise<void> {
  const { mondayOf, isoDate } = await import("@/lib/db");
  const target = mondayOf(now);
  target.setDate(target.getDate() + 7); // next week's Monday

  console.log(`[scheduler] generating week ${isoDate(target)}`);
  const { runAutoWeekGeneration } = await import("@/lib/auto-gen");
  const result = await runAutoWeekGeneration(target);
  console.log("[scheduler] result:", result);

  // Retry-on-error: only mark "ran today" on success/skip, so a transient
  // failure (e.g. network blip) is retried on the next tick instead of
  // leaving the week empty until next Saturday.
  const state = globalThis.__familyMenuScheduler;
  if (state && result.status !== "error") {
    state.lastRun = `${localDateKey(now)}-${result.status}`;
  }
}

async function tick(): Promise<void> {
  const now = new Date();
  // Saturday 09:00–09:59 local time
  if (now.getDay() !== 6 || now.getHours() !== 9) return;
  if (globalThis.__familyMenuScheduler?.lastRun?.startsWith(localDateKey(now))) {
    return; // already ran today
  }
  await runFor(now);
}

async function bootCatchUp(): Promise<void> {
  const now = new Date();
  // Only relevant on Saturday after the 09:00 window has opened.
  if (now.getDay() !== 6 || now.getHours() < 9) return;
  if (globalThis.__familyMenuScheduler?.lastRun?.startsWith(localDateKey(now))) {
    return;
  }
  console.log("[scheduler] boot catch-up: missed Saturday window, running now");
  await runFor(now);
}
