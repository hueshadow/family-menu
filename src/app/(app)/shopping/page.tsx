import { ShoppingList } from "@/components/shopping-list";
import { getShoppingListByWeekStart, mondayOf } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NainaHome() {
  const monday = mondayOf();
  const list = await getShoppingListByWeekStart(monday);

  const saturday = new Date(monday);
  saturday.setDate(saturday.getDate() + 5);
  const fmt = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;
  const weekLabel = `${fmt(monday)} – ${fmt(saturday)}`;

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4 print:hidden">
        <h3 className="text-2xl font-semibold">本周采购清单</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          按品类整理 · 移动端勾选式
        </p>
      </div>

      {list ? (
        <ShoppingList listId={list.id} items={list.items} weekLabel={weekLabel} />
      ) : (
        <div className="rounded-md border bg-muted/30 p-6 text-center text-base">
          <p>本周采购清单还没生成。</p>
          <p className="mt-1 text-sm text-muted-foreground">
            请妈妈在「本周菜单」录入并保存后即可看到。
          </p>
        </div>
      )}
    </div>
  );
}
