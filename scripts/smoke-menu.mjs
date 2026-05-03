// Smoke test: insert a sample week menu + derive shopping list, then read back.
// Usage: npm run smoke

import pg from "pg";

const client = new pg.Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  database: process.env.SUPABASE_DB_NAME,
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

// build current week (Monday-based)
const today = new Date();
today.setHours(0, 0, 0, 0);
const dow = today.getDay();
const diff = dow === 0 ? -6 : 1 - dow;
const monday = new Date(today);
monday.setDate(today.getDate() + diff);
const wsIso = monday.toISOString().slice(0, 10);

const sample = [
  ["清蒸鲈鱼", "鲈鱼 1 条, 葱姜适量, 蒸鱼豉油"],
  ["番茄炒蛋", "番茄 3 个, 鸡蛋 4 个"],
  ["蒜蓉芹菜香干", "芹菜 1 把, 香干 1 包, 蒜适量"],
  ["紫菜虾皮蛋花汤", "紫菜 1 包, 虾皮 1 把, 鸡蛋 2 个"],
];

const days = Array.from({ length: 6 }, (_, i) => {
  const d = new Date(monday);
  d.setDate(monday.getDate() + i);
  return {
    date: d.toISOString().slice(0, 10),
    dishes: sample.map(([name, ingredients]) => ({ name, ingredients })),
  };
});

const existing = await client.query(
  "select id from weekly_menus where week_start = $1",
  [wsIso],
);
let weekId;
if (existing.rows[0]) {
  weekId = existing.rows[0].id;
  await client.query(
    "update weekly_menus set days = $1::jsonb where id = $2",
    [JSON.stringify(days), weekId],
  );
  console.log(`✓ updated week ${wsIso}`);
} else {
  const r = await client.query(
    "insert into weekly_menus (week_start, status, days) values ($1,'draft',$2::jsonb) returning id",
    [wsIso, JSON.stringify(days)],
  );
  weekId = r.rows[0].id;
  console.log(`✓ inserted week ${wsIso}`);
}

// aggregate
const map = new Map();
for (const d of days) {
  for (const dish of d.dishes) {
    const parts = dish.ingredients
      .split(/[,，;；\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const p of parts) {
      const m = p.match(/^([^\d\s]+)\s*(.*)$/);
      const name = (m?.[1] ?? p).trim();
      const qty = (m?.[2] ?? "").trim();
      const e = map.get(name) ?? { qty: [] };
      if (qty) e.qty.push(qty);
      map.set(name, e);
    }
  }
}
const items = Array.from(map.entries()).map(([name, v]) => {
  let category = "other";
  if (/鱼|虾|肉|鸡|蛋|豆|海带|排骨/.test(name)) category = "protein";
  else if (/菜|葱|姜|蒜|番茄|瓜|笋|菇|木耳|藕|山药/.test(name)) category = "vegetable";
  else if (/奶/.test(name)) category = "dairy";
  return { name, qty: v.qty.join(" + "), category, checked: false };
});

const sl = await client.query(
  "select id from shopping_lists where week_id = $1",
  [weekId],
);
if (sl.rows[0]) {
  await client.query(
    "update shopping_lists set items = $1::jsonb where id = $2",
    [JSON.stringify(items), sl.rows[0].id],
  );
} else {
  await client.query(
    "insert into shopping_lists (week_id, items) values ($1, $2::jsonb)",
    [weekId, JSON.stringify(items)],
  );
}
console.log(`✓ shopping list with ${items.length} items`);

await client.end();
