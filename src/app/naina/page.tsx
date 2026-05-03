export default function NainaHome() {
  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4">
        <h3 className="text-2xl font-semibold">本周采购清单</h3>
        <p className="mt-2 text-base text-muted-foreground">
          M2：按品类显示，可勾选已购，大字号，移动端友好。
        </p>
      </div>
      <ul className="space-y-2 text-base">
        <li>🐟 蛋白类 — 待生成</li>
        <li>🥬 蔬菜 — 待生成</li>
        <li>🥛 奶/水果 — 待生成</li>
      </ul>
    </div>
  );
}
