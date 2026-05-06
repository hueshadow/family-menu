// Seed initial family members. Idempotent — re-run safely.
// Usage: npm run seed

import pg from "pg";

const required = [
  "SUPABASE_DB_HOST",
  "SUPABASE_DB_PORT",
  "SUPABASE_DB_NAME",
  "SUPABASE_DB_USER",
  "SUPABASE_DB_PASSWORD",
];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`✗ missing env: ${k}`);
    process.exit(1);
  }
}

const MEMBERS = [
  {
    name: "爷爷",
    role: "yeye",
    age: 63,
    profile: {
      healthFlags: ["轻度高血压"],
      allergies: [],
      intolerances: [],
      goals: ["清淡饮食", "辅助降压", "补 B 族", "补钙"],
      notes: "推荐降压食材：芹菜、洋葱、海带、香菇、深海鱼、燕麦、黑木耳",
    },
  },
  {
    name: "奶奶",
    role: "nainai",
    age: 62,
    profile: {
      healthFlags: ["体质偏弱", "消化功能弱"],
      allergies: [],
      intolerances: [],
      goals: ["高蛋白且易吸收", "补 B 族", "补钙"],
      notes: "优先：嫩肉、鱼、蛋羹、豆腐、酸奶、蒸炖类",
    },
  },
  {
    name: "爸爸",
    role: "baba",
    age: 36,
    profile: {
      healthFlags: [],
      allergies: [],
      intolerances: [],
      goals: [
        "增肌增力（多吃红肉）",
        "高蛋白",
        "适度控碳水",
        "控油",
      ],
      preferences: [
        "红肉优先：瘦牛肉 / 羊肉 / 瘦猪里脊 / 鸭肉，每周至少 3 次",
      ],
      notes:
        "午餐带餐 — 本周晚餐菜单中至少 1-2 道菜应耐冷藏 + 隔夜微波（如炖菜、卤味、红烧、糖醋、蒸菜），避开易出水 / 易变色的凉拌生菜与油炸脆皮；去皮去脂；杂粮主食优先。",
    },
  },
  {
    name: "妈妈",
    role: "mama",
    age: 35,
    profile: {
      healthFlags: [],
      allergies: [],
      intolerances: ["乳糖不耐（轻度，可酸奶）"],
      goals: ["减脂", "高蛋白", "控碳水", "控油"],
      preferences: ["偏好香料：八角 / 桂皮 / 香叶 / 花椒 / 孜然 / 迷迭香 / 罗勒"],
      notes: "牛奶用无乳糖奶 / 燕麦奶 / 杏仁奶替代；酸奶可",
    },
  },
  {
    name: "宝宝",
    role: "baby",
    age: 1,
    profile: {
      healthFlags: ["18 月龄，85cm，24 斤（偏高大）"],
      allergies: [],
      intolerances: [],
      goals: ["清淡软嫩", "易消化", "营养均衡"],
      notes: "食材剪碎；少盐少糖；坚果需细磨",
    },
  },
];

const client = new pg.Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT),
  database: process.env.SUPABASE_DB_NAME,
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log("→ connected");

for (const m of MEMBERS) {
  const existing = await client.query(
    "select id from family_members where role = $1 limit 1",
    [m.role],
  );
  if (existing.rows[0]) {
    await client.query(
      `update family_members
       set name = $1, age = $2, profile = $3
       where id = $4`,
      [m.name, m.age, m.profile, existing.rows[0].id],
    );
    console.log(`✓ updated ${m.name} (${m.role})`);
  } else {
    await client.query(
      `insert into family_members (name, role, age, profile) values ($1, $2, $3, $4)`,
      [m.name, m.role, m.age, m.profile],
    );
    console.log(`✓ inserted ${m.name} (${m.role})`);
  }
}

const { rows } = await client.query(
  "select role, name, age from family_members order by case role when 'yeye' then 1 when 'nainai' then 2 when 'baba' then 3 when 'mama' then 4 when 'baby' then 5 end",
);
console.log("→ family:", rows.map((r) => `${r.name}(${r.role}/${r.age})`).join(", "));

await client.end();
