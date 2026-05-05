import "server-only";
import { Pool } from "pg";
import {
  DISHES_PER_DAY,
  type DayInput,
  type DishInput,
  type MemberRow,
  type ShoppingItem,
  type ShoppingListRow,
  type WeekRow,
} from "@/lib/shared";

export type {
  DayInput,
  DishInput,
  MemberRow,
  MemberRole,
  ShoppingItem,
  ShoppingListRow,
  WeekRow,
} from "@/lib/shared";
export { CATEGORY_LABELS } from "@/lib/shared";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function getPool(): Pool {
  if (!globalThis.__pgPool) {
    const required = [
      "SUPABASE_DB_HOST",
      "SUPABASE_DB_PORT",
      "SUPABASE_DB_NAME",
      "SUPABASE_DB_USER",
      "SUPABASE_DB_PASSWORD",
    ];
    for (const k of required) {
      if (!process.env[k]) throw new Error(`missing env: ${k}`);
    }
    globalThis.__pgPool = new Pool({
      host: process.env.SUPABASE_DB_HOST,
      port: Number(process.env.SUPABASE_DB_PORT),
      database: process.env.SUPABASE_DB_NAME,
      user: process.env.SUPABASE_DB_USER,
      password: process.env.SUPABASE_DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
    });
  }
  return globalThis.__pgPool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const pool = getPool();
  const res = await pool.query(text, params);
  return res.rows as T[];
}

// ---------- date helpers ----------

export function mondayOf(d: Date = new Date()): Date {
  // Sunday → next Monday (the menu is for Mon–Sat, so Sunday should preview "tomorrow's week")
  // Mon–Sat → that same week's Monday
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = x.getDay(); // 0 Sun..6 Sat
  const diff = dow === 0 ? 1 : 1 - dow;
  x.setDate(x.getDate() + diff);
  return x;
}

export function isoDate(d: Date): string {
  // Local-timezone YYYY-MM-DD (UTC slice is wrong in UTC+8 — Sunday 22:00 local is Sunday 14:00 UTC,
  // but `toISOString().slice(0,10)` returns the UTC date which after a midnight reset is off by one).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function weekDates(weekStart: Date): Date[] {
  return Array.from({ length: 6 }, (_, i) => {
    const x = new Date(weekStart);
    x.setDate(x.getDate() + i);
    return x;
  });
}

// ---------- queries ----------

export async function getMembers(): Promise<MemberRow[]> {
  return query<MemberRow>(
    `select id, name, role, age, profile
     from family_members
     order by case role
       when 'yeye' then 1 when 'nainai' then 2
       when 'baba' then 3 when 'mama' then 4
       when 'baby' then 5 else 6 end`,
  );
}

function emptyDish(): DishInput {
  return { name: "", ingredients: "" };
}

function normalizeDays(days: DayInput[]): DayInput[] {
  return days.map((d) => {
    const dishes = [...(d.dishes ?? [])];
    while (dishes.length < DISHES_PER_DAY) dishes.push(emptyDish());
    return {
      ...d,
      style: d.style?.trim() || undefined,
      dishes: dishes.slice(0, DISHES_PER_DAY),
    };
  });
}

export async function getOrCreateWeek(weekStart: Date): Promise<WeekRow> {
  const wsIso = isoDate(weekStart);
  const existing = await query<WeekRow>(
    `select id, week_start::text, status, days, locked_at, auto_generated
     from weekly_menus where week_start = $1 limit 1`,
    [wsIso],
  );
  if (existing[0]) {
    return { ...existing[0], days: normalizeDays(existing[0].days) };
  }

  const emptyDays: DayInput[] = weekDates(weekStart).map((d) => ({
    date: isoDate(d),
    style: undefined,
    dishes: Array.from({ length: DISHES_PER_DAY }, () => emptyDish()),
  }));
  const [created] = await query<WeekRow>(
    `insert into weekly_menus (week_start, status, days)
     values ($1, 'draft', $2::jsonb)
     returning id, week_start::text, status, days, locked_at, auto_generated`,
    [wsIso, JSON.stringify(emptyDays)],
  );
  return created;
}

export interface HealthReportRow {
  id: string;
  member_id: string;
  year: number | null;
  storage_path: string;
  ocr_used: boolean;
  parsed: Record<string, unknown> | null;
  created_at: string;
}

export interface DietaryProfileRow {
  id: string;
  member_id: string;
  version: number;
  tags: string[];
  recommend: string[];
  avoid: string[];
  rationale: string | null;
  generated_at: string;
}

export async function insertHealthReport(args: {
  memberId: string;
  year: number | null;
  storagePath: string;
  ocrUsed: boolean;
  parsed: Record<string, unknown>;
}): Promise<string> {
  const rows = await query<{ id: string }>(
    `insert into health_reports (member_id, year, storage_path, ocr_used, parsed)
     values ($1, $2, $3, $4, $5::jsonb) returning id`,
    [args.memberId, args.year, args.storagePath, args.ocrUsed, JSON.stringify(args.parsed)],
  );
  return rows[0].id;
}

export async function getReportsByMember(memberId: string): Promise<HealthReportRow[]> {
  return query<HealthReportRow>(
    `select id, member_id, year, storage_path, ocr_used, parsed, created_at::text as created_at
     from health_reports where member_id = $1 order by created_at desc`,
    [memberId],
  );
}

export async function getAllReports(): Promise<HealthReportRow[]> {
  return query<HealthReportRow>(
    `select id, member_id, year, storage_path, ocr_used, parsed, created_at::text as created_at
     from health_reports order by created_at desc`,
  );
}

export async function upsertDietaryProfile(args: {
  memberId: string;
  tags: string[];
  recommend: string[];
  avoid: string[];
  rationale: string | null;
}): Promise<void> {
  // Bump version: get max + 1, archive older if needed (we just keep all rows; latest by version is current)
  const rows = await query<{ max: number | null }>(
    `select max(version) as max from dietary_profiles where member_id = $1`,
    [args.memberId],
  );
  const nextVersion = (rows[0]?.max ?? 0) + 1;
  await query(
    `insert into dietary_profiles (member_id, version, tags, recommend, avoid, rationale)
     values ($1, $2, $3, $4, $5, $6)`,
    [args.memberId, nextVersion, args.tags, args.recommend, args.avoid, args.rationale],
  );
}

export async function getLatestDietaryProfiles(): Promise<DietaryProfileRow[]> {
  return query<DietaryProfileRow>(
    `select distinct on (member_id)
       id, member_id, version, tags, recommend, avoid, rationale,
       generated_at::text as generated_at
     from dietary_profiles
     order by member_id, version desc`,
  );
}

export async function getLatestDietaryProfileFor(memberId: string): Promise<DietaryProfileRow | null> {
  const rows = await query<DietaryProfileRow>(
    `select id, member_id, version, tags, recommend, avoid, rationale,
       generated_at::text as generated_at
     from dietary_profiles where member_id = $1 order by version desc limit 1`,
    [memberId],
  );
  return rows[0] ?? null;
}

export interface RecipeRow {
  name: string;
  steps: string;
  notes: string | null;
}

export async function getRecipesByNames(names: string[]): Promise<RecipeRow[]> {
  if (names.length === 0) return [];
  return query<RecipeRow>(
    `select name, steps, notes from recipes where name = any($1::text[])`,
    [names],
  );
}

export async function saveWeekAnalysis(
  weekId: string,
  analysis: unknown,
): Promise<void> {
  await query(
    `update weekly_menus set analysis = $1::jsonb, analyzed_at = now() where id = $2`,
    [JSON.stringify(analysis), weekId],
  );
}

export interface WeekAnalysisRow {
  week_start: string;
  analysis: unknown;
  analyzed_at: string;
}

export async function getRecentAnalyses(limit = 8): Promise<WeekAnalysisRow[]> {
  return query<WeekAnalysisRow>(
    `select week_start::text, analysis, analyzed_at::text as analyzed_at
     from weekly_menus
     where analysis is not null
     order by week_start desc
     limit $1`,
    [limit],
  );
}

export async function getRecentWeeksMenu(
  beforeWeekStart: Date,
  count = 3,
): Promise<{ weekStart: string; dishes: string[] }[]> {
  const rows = await query<{ week_start: string; days: DayInput[] }>(
    `select week_start::text, days from weekly_menus
     where week_start < $1 order by week_start desc limit $2`,
    [isoDate(beforeWeekStart), count],
  );
  return rows.map((r) => ({
    weekStart: r.week_start,
    dishes: r.days
      .flatMap((d) => d.dishes.map((x) => x.name))
      .filter((n) => !!n?.trim()),
  }));
}

export async function saveWeek(
  weekId: string,
  days: DayInput[],
): Promise<void> {
  await query(
    `update weekly_menus set days = $1::jsonb where id = $2`,
    [JSON.stringify(days), weekId],
  );
}

export async function aggregateAndStoreShoppingList(
  weekId: string,
  days: DayInput[],
): Promise<void> {
  const items = aggregateIngredients(days);
  const existing = await query<{ id: string }>(
    `select id from shopping_lists where week_id = $1 limit 1`,
    [weekId],
  );
  if (existing[0]) {
    // preserve checked states
    const prev = await query<ShoppingListRow>(
      `select id, week_id, items from shopping_lists where id = $1`,
      [existing[0].id],
    );
    const prevMap = new Map(prev[0].items.map((i) => [i.name, i.checked]));
    const merged = items.map((i) => ({
      ...i,
      checked: prevMap.get(i.name) ?? false,
    }));
    await query(
      `update shopping_lists set items = $1::jsonb where id = $2`,
      [JSON.stringify(merged), existing[0].id],
    );
  } else {
    await query(
      `insert into shopping_lists (week_id, items) values ($1, $2::jsonb)`,
      [weekId, JSON.stringify(items)],
    );
  }
}

export async function getShoppingListByWeekStart(
  weekStart: Date,
): Promise<ShoppingListRow | null> {
  const wsIso = isoDate(weekStart);
  const rows = await query<ShoppingListRow>(
    `select sl.id, sl.week_id, sl.items
     from shopping_lists sl
     join weekly_menus wm on wm.id = sl.week_id
     where wm.week_start = $1
     limit 1`,
    [wsIso],
  );
  return rows[0] ?? null;
}

export async function setShoppingItemChecked(
  listId: string,
  itemName: string,
  checked: boolean,
): Promise<void> {
  await query(
    `update shopping_lists
     set items = (
       select jsonb_agg(
         case when (i->>'name') = $2
              then jsonb_set(i, '{checked}', to_jsonb($3::boolean))
              else i end
       )
       from jsonb_array_elements(items) i
     )
     where id = $1`,
    [listId, itemName, checked],
  );
}

// ---------- ingredient aggregation ----------

// Skip these entirely — household necessities, not purchasable line items
const HOUSEHOLD_BASICS = new Set([
  "水",
  "温水",
  "热水",
  "凉水",
  "开水",
  "清水",
  "纯净水",
  "矿泉水",
  "白水",
]);

// Normalize alternate names → canonical
const NAME_NORMALIZE: Record<string, string> = {
  蛋清: "鸡蛋",
  蛋黄: "鸡蛋",
  鸡蛋清: "鸡蛋",
  鸡蛋黄: "鸡蛋",
  鸡蛋液: "鸡蛋",
};

// Pantry seasoning patterns (tested against full name) → kind="pantry"
const SEASONING_RULES: RegExp[] = [
  /油$/,                                                         // 菜籽油 / 橄榄油 / 香油 / 麻油 / 茶油
  /^盐$/, /^食盐$/, /精盐/, /低钠盐/,
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
  /^糟卤$/, /低盐糟卖$/, /低盐糟卤$/,
  /淀粉$/, /生粉$/, /玉米淀粉$/,
  /^味精$/, /^鸡精$/,
];

// Fresh aromatics: collapse all variants into one canonical, fixed amount
// (because 姜片2片+4片+3片+... is silly — you buy a chunk of ginger)
interface AromaticRule {
  match: RegExp;
  canonical: string;
  qty: string;
}
const FRESH_AROMATIC_RULES: AromaticRule[] = [
  { match: /^姜/, canonical: "姜", qty: "1 块（约 100 克）" },
  { match: /^葱/, canonical: "葱", qty: "1 把（约 100 克）" },
  { match: /^蒜/, canonical: "蒜", qty: "1 头（约 50 克）" },
];

const CATEGORY_KEYWORDS: Array<[string[], string]> = [
  [["鱼", "虾", "肉", "鸡", "鸭", "牛", "猪", "排骨", "蛋", "豆腐", "豆干", "豆", "海带", "豆瓣", "鳝"], "protein"],
  [["菜", "葱", "姜", "蒜", "番茄", "西红柿", "茄", "瓜", "萝卜", "笋", "菇", "木耳", "藕", "山药", "豆芽", "玉米", "韭", "椒", "葱花"], "vegetable"],
  [["果", "莓", "橙", "蕉", "桃", "瓜"], "fruit"],
  [["奶", "酸奶", "奶酪", "起司"], "dairy"],
  [["米", "面", "粉", "麦", "燕麦", "馒头", "面包"], "grain"],
];

function categorize(name: string): string {
  for (const [keys, cat] of CATEGORY_KEYWORDS) {
    if (keys.some((k) => name.includes(k))) return cat;
  }
  return "other";
}

function isSeasoning(name: string): boolean {
  return SEASONING_RULES.some((re) => re.test(name));
}

function findAromatic(name: string): AromaticRule | null {
  for (const r of FRESH_AROMATIC_RULES) {
    if (r.match.test(name)) return r;
  }
  return null;
}

function mergeQty(qtys: string[]): string {
  if (qtys.length === 0) return "";
  // Drop pure 适量/少许; if everything was that, return 适量
  const meaningful = qtys.filter(
    (q) => !/^(适量|少许|若干)$/.test(q.trim()),
  );
  if (meaningful.length === 0) return "适量";

  // Try to sum mass quantities
  const masses: number[] = [];
  const volumes: number[] = []; // ml
  const counts = new Map<string, number>(); // unit → sum
  const fallback: string[] = [];

  for (const raw of meaningful) {
    const q = raw.trim();
    const mMass = q.match(/^(\d+(?:\.\d+)?)\s*(克|g|kg|千克|斤|两|公斤)$/);
    if (mMass) {
      let g = Number(mMass[1]);
      const u = mMass[2];
      if (u === "kg" || u === "千克" || u === "公斤") g *= 1000;
      else if (u === "斤") g *= 500;
      else if (u === "两") g *= 50;
      masses.push(g);
      continue;
    }
    const mVol = q.match(/^(\d+(?:\.\d+)?)\s*(毫升|ml|升|l|L)$/);
    if (mVol) {
      let v = Number(mVol[1]);
      const u = mVol[2];
      if (u === "升" || u === "l" || u === "L") v *= 1000;
      volumes.push(v);
      continue;
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

  const parts: string[] = [];
  if (masses.length) {
    parts.push(`${masses.reduce((a, b) => a + b, 0)} 克`);
  }
  if (volumes.length) {
    parts.push(`${volumes.reduce((a, b) => a + b, 0)} 毫升`);
  }
  // Counts: collapse if too many small units (姜片 N×slices) → use 适量 instead
  for (const [unit, total] of counts) {
    // Slice / piece / leaf sums above 5 are silly — treat as 适量
    if (/^(片|粒|颗|瓣|段)$/.test(unit) && total > 5) {
      parts.push("适量");
    } else {
      parts.push(`${total} ${unit}`);
    }
  }
  if (fallback.length) {
    parts.push(...Array.from(new Set(fallback)));
  }
  return parts.join(" + ");
}

export function aggregateIngredients(days: DayInput[]): ShoppingItem[] {
  interface Entry {
    qty: string[];
    category: string;
    kind: "buy" | "pantry";
    fixedQty?: string;
  }
  const map = new Map<string, Entry>();

  for (const d of days) {
    for (const dish of d.dishes) {
      if (!dish.ingredients?.trim()) continue;
      const parts = dish.ingredients
        .split(/[,，;；\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

      for (const p of parts) {
        const m = p.match(/^([^\d\s]+)\s*(.*)$/);
        let name = (m?.[1] ?? p).trim();
        const qty = (m?.[2] ?? "").trim();

        if (HOUSEHOLD_BASICS.has(name)) continue;
        name = NAME_NORMALIZE[name] ?? name;

        // Fresh aromatic: fixed amount, ignore individual qty
        const aromatic = findAromatic(name);
        if (aromatic) {
          if (!map.has(aromatic.canonical)) {
            map.set(aromatic.canonical, {
              qty: [],
              category: "vegetable",
              kind: "buy",
              fixedQty: aromatic.qty,
            });
          }
          continue;
        }

        // Seasoning: pantry confirm
        if (isSeasoning(name)) {
          if (!map.has(name)) {
            map.set(name, { qty: [], category: "seasoning", kind: "pantry" });
          }
          continue;
        }

        // Default: buyable
        const entry = map.get(name) ?? {
          qty: [],
          category: categorize(name),
          kind: "buy" as const,
        };
        if (qty) entry.qty.push(qty);
        map.set(name, entry);
      }
    }
  }

  const items: ShoppingItem[] = Array.from(map.entries()).map(([name, v]) => ({
    name,
    qty: v.fixedQty ?? mergeQty(v.qty),
    category: v.category,
    kind: v.kind,
    checked: false,
  }));

  const order = ["protein", "vegetable", "dairy", "fruit", "grain", "seasoning", "other"];
  items.sort((a, b) => {
    // pantry items always at end
    if ((a.kind ?? "buy") !== (b.kind ?? "buy")) {
      return (a.kind ?? "buy") === "buy" ? -1 : 1;
    }
    return (
      order.indexOf(a.category) - order.indexOf(b.category) ||
      a.name.localeCompare(b.name, "zh")
    );
  });
  return items;
}
