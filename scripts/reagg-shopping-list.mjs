// One-off: regenerate shopping_lists row using current aggregateIngredients logic.
// Same logic as src/lib/db.ts aggregateIngredients (kept in sync).
// Usage: node --env-file=.env.local scripts/reagg-shopping-list.mjs [weekStart]

import pg from "pg";

const weekStart = process.argv[2] || "2026-05-04";

const HOUSEHOLD_BASICS = new Set([
  "水","温水","热水","凉水","开水","清水","纯净水","矿泉水","白水",
]);

const NAME_NORMALIZE = {
  "蛋清": "鸡蛋", "蛋黄": "鸡蛋",
  "鸡蛋清": "鸡蛋", "鸡蛋黄": "鸡蛋", "鸡蛋液": "鸡蛋",
};

const SEASONING_RULES = [
  /油$/, /^盐$/, /^食盐$/, /精盐/, /低钠盐/,
  /酱$/, /酱油$/, /生抽$/, /老抽$/, /蚝油$/, /鱼露$/, /蒸鱼豉油$/,
  /醋$/, /^米醋$/, /^陈醋$/, /^香醋$/,
  /^糖$/, /冰糖$/, /^白糖$/, /^红糖$/,
  /料酒$/, /黄酒$/, /^米酒$/,
  /胡椒/, /^黑胡椒$/, /^白胡椒$/,
  /^花椒/, /^八角$/, /^桂皮$/, /^香叶$/,
  /^孜然$/, /^小茴香$/, /^草果$/, /^陈皮$/, /^豆蔻$/, /^丁香$/,
  /干辣椒$/, /辣椒粉$/, /辣椒油$/, /^辣椒$/,
  /豆豉$/, /豆瓣酱$/, /老干妈/,
  /^迷迭香$/, /^百里香$/, /^罗勒$/, /^月桂叶$/,
  /^糟卤$/, /低盐糟卤$/,
  /淀粉$/, /生粉$/, /玉米淀粉$/,
  /^味精$/, /^鸡精$/,
];

const FRESH_AROMATIC_RULES = [
  { match: /^姜/, canonical: "姜", qty: "1 块（约 100 克）" },
  { match: /^葱/, canonical: "葱", qty: "1 把（约 100 克）" },
  { match: /^蒜/, canonical: "蒜", qty: "1 头（约 50 克）" },
];

const CATEGORY_KEYWORDS = [
  [["鱼", "虾", "肉", "鸡", "鸭", "牛", "猪", "排骨", "蛋", "豆腐", "豆干", "豆", "海带", "豆瓣", "鳝"], "protein"],
  [["菜", "葱", "姜", "蒜", "番茄", "西红柿", "茄", "瓜", "萝卜", "笋", "菇", "木耳", "藕", "山药", "豆芽", "玉米", "韭", "椒", "葱花"], "vegetable"],
  [["果", "莓", "橙", "蕉", "桃"], "fruit"],
  [["奶", "酸奶", "奶酪", "起司"], "dairy"],
  [["米", "面", "粉", "麦", "燕麦", "馒头", "面包"], "grain"],
];

function categorize(name) {
  for (const [keys, cat] of CATEGORY_KEYWORDS) {
    if (keys.some((k) => name.includes(k))) return cat;
  }
  return "other";
}

function isSeasoning(name) {
  return SEASONING_RULES.some((re) => re.test(name));
}

function findAromatic(name) {
  for (const r of FRESH_AROMATIC_RULES) {
    if (r.match.test(name)) return r;
  }
  return null;
}

function mergeQty(qtys) {
  if (qtys.length === 0) return "";
  const meaningful = qtys.filter((q) => !/^(适量|少许|若干)$/.test(q.trim()));
  if (meaningful.length === 0) return "适量";
  const masses = [];
  const volumes = [];
  const counts = new Map();
  const fallback = [];
  for (const raw of meaningful) {
    const q = raw.trim();
    const mMass = q.match(/^(\d+(?:\.\d+)?)\s*(克|g|kg|千克|斤|两|公斤)$/);
    if (mMass) {
      let g = Number(mMass[1]);
      const u = mMass[2];
      if (u === "kg" || u === "千克" || u === "公斤") g *= 1000;
      else if (u === "斤") g *= 500;
      else if (u === "两") g *= 50;
      masses.push(g); continue;
    }
    const mVol = q.match(/^(\d+(?:\.\d+)?)\s*(毫升|ml|升|l|L)$/);
    if (mVol) {
      let v = Number(mVol[1]);
      const u = mVol[2];
      if (u === "升" || u === "l" || u === "L") v *= 1000;
      volumes.push(v); continue;
    }
    const mCount = q.match(/^(\d+(?:\.\d+)?)\s*(.+)$/);
    if (mCount) {
      const n = Number(mCount[1]);
      const u = mCount[2].trim();
      counts.set(u, (counts.get(u) ?? 0) + n);
      continue;
    }
    fallback.push(q);
  }
  const parts = [];
  if (masses.length) parts.push(`${masses.reduce((a, b) => a + b, 0)} 克`);
  if (volumes.length) parts.push(`${volumes.reduce((a, b) => a + b, 0)} 毫升`);
  for (const [u, t] of counts) {
    if (/^(片|粒|颗|瓣|段)$/.test(u) && t > 5) parts.push("适量");
    else parts.push(`${t} ${u}`);
  }
  if (fallback.length) parts.push(...new Set(fallback));
  return parts.join(" + ");
}

function aggregateIngredients(days) {
  const map = new Map();
  for (const d of days) {
    for (const dish of d.dishes) {
      if (!dish.ingredients?.trim()) continue;
      const parts = dish.ingredients.split(/[,，;；\n]/).map(s => s.trim()).filter(Boolean);
      for (const p of parts) {
        const m = p.match(/^([^\d\s]+)\s*(.*)$/);
        let name = (m?.[1] ?? p).trim();
        const qty = (m?.[2] ?? "").trim();
        if (HOUSEHOLD_BASICS.has(name)) continue;
        name = NAME_NORMALIZE[name] ?? name;
        const ar = findAromatic(name);
        if (ar) {
          if (!map.has(ar.canonical)) {
            map.set(ar.canonical, { qty: [], category: "vegetable", kind: "buy", fixedQty: ar.qty });
          }
          continue;
        }
        if (isSeasoning(name)) {
          if (!map.has(name)) map.set(name, { qty: [], category: "seasoning", kind: "pantry" });
          continue;
        }
        const e = map.get(name) ?? { qty: [], category: categorize(name), kind: "buy" };
        if (qty) e.qty.push(qty);
        map.set(name, e);
      }
    }
  }
  const items = [...map.entries()].map(([name, v]) => ({
    name,
    qty: v.fixedQty ?? mergeQty(v.qty),
    category: v.category,
    kind: v.kind,
    checked: false,
  }));
  const order = ["protein","vegetable","dairy","fruit","grain","seasoning","other"];
  items.sort((a, b) => {
    if ((a.kind ?? "buy") !== (b.kind ?? "buy")) return (a.kind ?? "buy") === "buy" ? -1 : 1;
    return order.indexOf(a.category) - order.indexOf(b.category) || a.name.localeCompare(b.name, "zh");
  });
  return items;
}

const c = new pg.Client({
  host: process.env.SUPABASE_DB_HOST, port: 5432, database: "postgres",
  user: process.env.SUPABASE_DB_USER, password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const r = await c.query(
  "select wm.id as week_id, wm.days from weekly_menus wm where wm.week_start = $1",
  [weekStart],
);
if (!r.rows.length) { console.error("no menu"); process.exit(1); }
const { week_id, days } = r.rows[0];

const items = aggregateIngredients(days);

const sl = await c.query("select id, items from shopping_lists where week_id = $1", [week_id]);
let prevChecked = new Map();
if (sl.rows[0]) prevChecked = new Map(sl.rows[0].items.map((i) => [i.name, i.checked]));
for (const i of items) i.checked = prevChecked.get(i.name) ?? false;

if (sl.rows[0]) {
  await c.query("update shopping_lists set items = $1::jsonb where id = $2", [JSON.stringify(items), sl.rows[0].id]);
} else {
  await c.query("insert into shopping_lists (week_id, items) values ($1, $2::jsonb)", [week_id, JSON.stringify(items)]);
}

const buy = items.filter((i) => i.kind === "buy");
const pantry = items.filter((i) => i.kind === "pantry");
console.log(`✓ aggregated · ${items.length} items (${buy.length} buy / ${pantry.length} pantry)`);
console.log("\n=== BUY (sample 20) ===");
for (const i of buy.slice(0, 20)) console.log(`  ${i.category.padEnd(10)} ${i.name.padEnd(12)} ${i.qty}`);
console.log("\n=== PANTRY ===");
for (const i of pantry) console.log(`  ${i.name}`);

await c.end();
