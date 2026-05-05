import { getRecentAnalyses } from "@/lib/db";
import type { NutritionAnalysis } from "@/lib/menu-gen";

export const dynamic = "force-dynamic";

const LEVEL_COLOR: Record<string, string> = {
  充足: "bg-emerald-500",
  基本满足: "bg-green-500",
  略不足: "bg-yellow-500",
  明显不足: "bg-red-500",
  偏高: "bg-orange-500",
};

const LEVEL_TEXT: Record<string, string> = {
  充足: "text-emerald-700",
  基本满足: "text-green-700",
  略不足: "text-yellow-700",
  明显不足: "text-red-700",
  偏高: "text-orange-700",
};

export default async function TrendPage() {
  const rows = await getRecentAnalyses(8);
  if (rows.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-2xl font-semibold">营养趋势</h3>
        <p className="text-sm text-muted-foreground">
          还没有任何已分析的周菜单。回 <code>/menu</code> 点 「营养分析」即可记录本周指标。
        </p>
      </div>
    );
  }

  // Order chronological: oldest first → newest right
  const ordered = [...rows].reverse();
  const analyses = ordered.map(
    (r) => r.analysis as unknown as NutritionAnalysis,
  );

  // Collect unique metric names while preserving order
  const seen = new Set<string>();
  const metrics: string[] = [];
  for (const a of analyses) {
    for (const m of a.metrics) {
      if (!seen.has(m.name)) {
        seen.add(m.name);
        metrics.push(m.name);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold">营养趋势</h3>
        <p className="text-sm text-muted-foreground">
          近 {ordered.length} 周已分析菜单 · 每行一项指标，从左（旧）到右（新）
        </p>
      </div>

      <Legend />

      <section className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="px-2 py-2 text-left font-normal">指标</th>
              {ordered.map((r) => (
                <th key={r.week_start} className="px-2 py-2 text-center font-normal">
                  {r.week_start.slice(5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((metricName) => (
              <tr key={metricName} className="border-b last:border-0">
                <td className="px-2 py-3 font-medium">{metricName}</td>
                {analyses.map((a, i) => {
                  const cell = a.metrics.find((m) => m.name === metricName);
                  return (
                    <td key={i} className="px-2 py-3 text-center">
                      {cell ? (
                        <div
                          className={`mx-auto size-5 rounded-full ${LEVEL_COLOR[cell.level] ?? "bg-muted"}`}
                          title={`${cell.level} · ${cell.note}`}
                        />
                      ) : (
                        <div className="mx-auto size-5 rounded-full bg-muted/40" title="未分析" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <h4 className="text-lg font-semibold">最新一周改进建议</h4>
        <ul className="list-inside list-disc space-y-1 text-sm">
          {analyses[analyses.length - 1].improvements.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
        <p className={`text-xs ${LEVEL_TEXT["基本满足"]}`}>
          {analyses[analyses.length - 1].overall}
        </p>
      </section>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {Object.entries(LEVEL_COLOR).map(([level, cls]) => (
        <span key={level} className="flex items-center gap-1.5">
          <span className={`size-3 rounded-full ${cls}`} />
          {level}
        </span>
      ))}
    </div>
  );
}
