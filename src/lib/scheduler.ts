import "server-only";

declare global {
  // eslint-disable-next-line no-var
  var __familyMenuScheduler: { started: boolean; lastRun: string | null } | undefined;
}

const TICK_INTERVAL_MS = 5 * 60 * 1000; // 5 min

export function startScheduler(): void {
  if (globalThis.__familyMenuScheduler?.started) return;
  globalThis.__familyMenuScheduler = { started: true, lastRun: null };
  console.log("[scheduler] started · 周日 09:00 自动生成下周菜单");

  setInterval(() => {
    void tick().catch((e) => {
      console.error("[scheduler] tick error:", e);
    });
  }, TICK_INTERVAL_MS);

  // Also tick shortly after boot to log + check immediately if we're in the trigger window
  setTimeout(() => {
    void tick().catch((e) => {
      console.error("[scheduler] initial tick error:", e);
    });
  }, 10_000);
}

export function getSchedulerState(): { started: boolean; lastRun: string | null } {
  return (
    globalThis.__familyMenuScheduler ?? { started: false, lastRun: null }
  );
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function tick(): Promise<void> {
  const now = new Date();
  const dow = now.getDay(); // 0 = Sunday
  const hour = now.getHours();

  // Run only Sunday 09:00–09:59 local time
  if (dow !== 0 || hour !== 9) return;

  const tomorrow = new Date(now);
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1); // Monday

  const isoMonday = localDateKey(tomorrow);
  const todayLocal = localDateKey(now);
  const state = globalThis.__familyMenuScheduler;
  if (state?.lastRun?.startsWith(todayLocal)) {
    return; // already ran today
  }

  console.log(`[scheduler] running auto-generation for week ${isoMonday}`);
  const { runAutoWeekGeneration } = await import("@/lib/auto-gen");
  const result = await runAutoWeekGeneration(tomorrow);
  if (state) state.lastRun = `${todayLocal}-${hour}:${result.status}`;
  console.log(`[scheduler] result:`, result);
}
