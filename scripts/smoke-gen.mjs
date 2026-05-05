// E2E AI generation smoke test: build week prompt → call AI → validate JSON shape.
// Usage: npm run smoke:gen

import pg from "pg";

const baseURL = process.env.AI_BASE_URL;
const apiKey = process.env.AI_API_KEY;
const model = process.env.AI_MODEL_PRIMARY || "gpt-5.5";

const SYSTEM = `你是一位江浙家常菜厨师 + 营养师，为一个 5 口家庭设计家常菜单。

【菜系定位】
- 江浙家常为主：清蒸、红烧（少糖少油版）、糖醋（轻甜）、白灼、炖煮、糟卤
- 可适度加入其他菜系的家常做法，如川菜（轻麻轻辣版）、徽菜、地中海风味，但仍以清爽、易消化、适合家庭同桌为前提
- 重原汁原味，避免重油重辣和刺激性过强
- 时令食材优先
- 一周 6 天菜单中，可安排 1-2 天出现适度融合的其他菜系风格，其余仍以江浙家常为主
- 若使用川菜风格，只能采用轻麻、轻辣、少油版本，不得影响老人和宝宝进食
- 若使用徽菜风格，优先炖煮、蒸烧、菌菇、笋干、豆制品等家常做法，避免重油、重咸、重酱色
- 若使用地中海风味，优先鱼类、豆类、番茄、菌菇、橄榄油、香草等清爽组合，避免生冷难消化做法

【全家同桌原则】每天 5 道菜（主荤 / 副荤 / 蔬菜 / 凉菜 / 汤）全员同享。

【硬约束】
1. 爷爷高血压：低钠；推荐降压食材（芹菜/洋葱/海带/香菇/深海或河鲜/燕麦/黑木耳）
2. 奶奶易消化：避免坚硬粗纤维；蒸炖、嫩肉/鱼/蛋/豆制品优先
3. 爸妈减脂：去皮去脂、少油；高蛋白足量
4. 妈妈乳糖：菜中不用奶酪/鲜奶（酸奶可）；偏好香料（八角/桂皮/香叶/花椒/孜然/迷迭香/罗勒）
5. 宝宝（18M）：清淡软嫩；坚果不整粒；可剪碎
6. 周内同菜不重复，每周至少 2 次鱼

【输出语言】简体中文。食材格式："鲈鱼 1 条, 葱姜适量, 蒸鱼豉油"。`;

const client = new pg.Client({
  host: process.env.SUPABASE_DB_HOST,
  port: 5432,
  database: "postgres",
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const { rows: members } = await client.query(
  `select name, age, profile from family_members
   order by case role when 'yeye' then 1 when 'nainai' then 2 when 'baba' then 3 when 'mama' then 4 when 'baby' then 5 end`,
);
await client.end();

const today = new Date();
today.setHours(0, 0, 0, 0);
const dow = today.getDay();
const diff = dow === 0 ? -6 : 1 - dow;
const monday = new Date(today);
monday.setDate(today.getDate() + diff);
const dates = Array.from({ length: 6 }, (_, i) => {
  const d = new Date(monday);
  d.setDate(monday.getDate() + i);
  return d.toISOString().slice(0, 10);
});

const familyText = members
  .map((m) => {
    const p = m.profile;
    const lines = [];
    if (p.healthFlags?.length) lines.push(`健康：${p.healthFlags.join(" / ")}`);
    if (p.intolerances?.length) lines.push(`不耐：${p.intolerances.join(" / ")}`);
    if (p.goals?.length) lines.push(`目标：${p.goals.join(" / ")}`);
    if (p.preferences?.length) lines.push(`偏好：${p.preferences.join(" / ")}`);
    if (p.notes) lines.push(`备注：${p.notes}`);
    return `- ${m.name}（${m.age}岁）\n  ${lines.join("\n  ")}`;
  })
  .join("\n");

const userPrompt = `【家庭成员】
${familyText}

【本周日期】${dates.join(", ")}

【任务】6 天每天 5 道菜（主荤/副荤/蔬菜/凉菜/汤）。每一天都要给出 style 字段，默认写"江浙家常"，只有融合其他菜系时才写"川菜轻改"、"徽菜轻改"、"地中海轻改"。仅输出 JSON：

{"days":[{"date":"YYYY-MM-DD","style":"江浙家常","dishes":[{"slot":"主荤","name":"...","ingredients":"...","reason":"..."},{"slot":"副荤"},{"slot":"蔬菜"},{"slot":"凉菜"},{"slot":"汤"}]}]}`;

console.log("→ calling", model, "with", userPrompt.length, "char prompt");
const t0 = Date.now();
const res = await fetch(`${baseURL}/v1/chat/completions`, {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userPrompt },
    ],
  }),
});
const elapsed = Date.now() - t0;
const data = await res.json();
console.log(`← ${res.status} in ${elapsed}ms`);
console.log("usage:", data.usage);

const content = data?.choices?.[0]?.message?.content ?? "";
let parsed;
try {
  parsed = JSON.parse(content.trim());
} catch {
  const m = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) parsed = JSON.parse(m[1]);
  else {
    const f = content.indexOf("{"), l = content.lastIndexOf("}");
    parsed = JSON.parse(content.slice(f, l + 1));
  }
}

console.log(`✓ parsed: ${parsed.days.length} days`);
for (const d of parsed.days.slice(0, 3)) {
  console.log(`  ${d.date} [${d.style ?? "missing-style"}]: ${d.dishes.map((x) => x.name).join(" | ")}`);
}
const totalDishes = parsed.days.reduce((a, d) => a + d.dishes.length, 0);
console.log(`✓ total dishes: ${totalDishes}  (expect 30)`);
console.log(`✓ styles present: ${parsed.days.filter((d) => !!d.style).length}/${parsed.days.length}`);

const styleHints = [
  "川", "麻婆", "藤椒", "椒麻", "鱼香", "口水", "红油",
  "徽", "笋干", "臭鳜鱼", "毛豆腐",
  "地中海", "橄榄油", "罗勒", "迷迭香", "番茄豆", "香草",
];

console.log("\nStyle scan:");
for (const d of parsed.days) {
  const names = d.dishes.map((x) => x.name).join(" | ");
  const matches = styleHints.filter((hint) => names.includes(hint));
  console.log(`  ${d.date}: ${matches.length ? matches.join(", ") : "none"}`);
}
