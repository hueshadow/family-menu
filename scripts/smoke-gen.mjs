// E2E AI generation smoke test: build week prompt → call AI → validate JSON shape.
// Usage: npm run smoke:gen

import pg from "pg";

const baseURL = process.env.AI_BASE_URL;
const apiKey = process.env.AI_API_KEY;
const model = process.env.AI_MODEL_PRIMARY || "gpt-5.5";

const SYSTEM = `你是一位苏州本帮 / 江浙菜厨师 + 营养师，为一个 5 口家庭设计家常菜单。

【菜系定位】苏州本帮、江浙家常；清蒸/红烧/糖醋（少糖少油）/白灼/炖煮；时令食材优先。

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

【任务】6 天每天 5 道菜（主荤/副荤/蔬菜/凉菜/汤）。仅输出 JSON：

{"days":[{"date":"YYYY-MM-DD","dishes":[{"slot":"主荤","name":"...","ingredients":"...","reason":"..."},{"slot":"副荤"},{"slot":"蔬菜"},{"slot":"凉菜"},{"slot":"汤"}]}]}`;

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
  console.log(`  ${d.date}: ${d.dishes.map((x) => x.name).join(" | ")}`);
}
const totalDishes = parsed.days.reduce((a, d) => a + d.dishes.length, 0);
console.log(`✓ total dishes: ${totalDishes}  (expect 30)`);
