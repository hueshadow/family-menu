export default function AyiHome() {
  const today = new Date().toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4">
        <h3 className="text-xl font-semibold">{today}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          M2：按当日 4 道菜展开做法，含老人/宝宝注意事项与 AI 替代食材。
        </p>
      </div>
      <ul className="space-y-2 text-sm">
        <li>🐠 主荤 — 待生成</li>
        <li>🍳 副荤 — 待生成</li>
        <li>🥬 蔬菜 — 待生成</li>
        <li>🍲 汤 — 待生成</li>
      </ul>
    </div>
  );
}
