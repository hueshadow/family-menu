// Batch process all health report PDFs in HEALTH_REPORTS_DIR.
// Maps filenames to family members heuristically, parses indicators with AI,
// then synthesizes per-member dietary profile from all that member's reports.
//
// Usage: npm run batch:reports

import { exec } from "node:child_process";
import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import pg from "pg";

const execp = promisify(exec);

const baseURL = process.env.AI_BASE_URL;
const apiKey = process.env.AI_API_KEY;
const primary = process.env.AI_MODEL_PRIMARY || "gpt-5.5";
const vision = process.env.AI_MODEL_VISION || "gpt-4o";
const dir = process.env.HEALTH_REPORTS_DIR;

const ROLE_KEYWORDS = [
  ["yeye", ["爷爷"]],
  ["nainai", ["奶奶"]],
  ["mama", ["妈妈"]],
  ["baba", ["爸爸", "陆喆霆"]],
  ["baby", ["宝宝", "婴儿", "幼儿"]],
];

function guessRole(filename) {
  for (const [role, keys] of ROLE_KEYWORDS) {
    if (keys.some((k) => filename.includes(k))) return role;
  }
  return null;
}

const PII_PATTERNS = [
  [/[一-龥]{2,4}先生|[一-龥]{2,4}女士/g, "[姓名]"],
  [/姓\s*名[：: ]+\S+/g, "姓名: [姓名]"],
  [/(身份证号?|证件号?)[：: ]*[\dXx]{15,18}/g, "身份证: [已脱敏]"],
  [/\b\d{17}[\dXx]\b/g, "[身份证号]"],
  [/\b1[3-9]\d{9}\b/g, "[手机]"],
];
function maskPII(text) {
  let out = text;
  for (const [re, repl] of PII_PATTERNS) out = out.replace(re, repl);
  return out;
}

const SYSTEM_PARSER = `你是一位中文医疗体检报告结构化解析助手。从原文中提取与饮食营养相关的指标。
类别：代谢、血脂、血压、血常规、肝肾、甲状腺、营养、其他。
忽略影像 / 心电图 / 体格 / 妇科 / 视力听力等非饮食项。
输出严格 JSON：
{"reportYear": 数字 或 null, "indicators": {"代谢":{"指标":{"value":1.2,"unit":"mmol/L","abnormal":false}},...}, "abnormal_summary":["..."], "raw_observations":["..."]}`;

const SYSTEM_PRESCRIBER = `你是一位中医营养师，依据体检指标 + 家庭成员基础情况，输出饮食处方。
要求：
1. 只输出与饮食强相关的建议
2. 推荐与忌口要具体可执行（食材级别）
3. 优先清淡 / 易消化 / 高蛋白 / 江浙苏州家常菜可落地范围
4. tags: 3-6 个中文短词（如"高血压"、"血脂偏高"、"易消化"等）

输出严格 JSON：
{"tags":["..."], "recommend":["..."], "avoid":["..."], "rationale":"一句话依据"}`;

function parseJsonLoose(text) {
  try {
    return JSON.parse(text.trim());
  } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence)
    try {
      return JSON.parse(fence[1].trim());
    } catch {}
  const f = text.indexOf("{"),
    l = text.lastIndexOf("}");
  if (f >= 0 && l > f)
    try {
      return JSON.parse(text.slice(f, l + 1));
    } catch {}
  throw new Error(`unparseable: ${text.slice(0, 200)}`);
}

async function callAI(model, messages) {
  const t0 = Date.now();
  const res = await fetch(`${baseURL}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  return {
    content: data.choices?.[0]?.message?.content ?? "",
    usage: data.usage,
    elapsed,
  };
}

async function parseReportFromText(filepath, member) {
  const { stdout } = await execp(
    `pdftotext -layout ${JSON.stringify(filepath)} -`,
    { maxBuffer: 32 * 1024 * 1024 },
  );
  const masked = maskPII(stdout).slice(0, 30000);
  const r = await callAI(primary, [
    { role: "system", content: SYSTEM_PARSER },
    {
      role: "user",
      content: `【家庭成员】${member.name}（${member.age}岁）\n\n【报告原文（已脱敏）】\n${masked}`,
    },
  ]);
  console.log(`     ↳ text path · ${r.elapsed}s · tokens=${r.usage?.total_tokens}`);
  return { parsed: parseJsonLoose(r.content), ocrUsed: false };
}

async function parseReportFromImages(filepath, member) {
  const wd = join(tmpdir(), `fmp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(wd, { recursive: true });
  const prefix = join(wd, "page");
  try {
    await execp(
      `pdftoppm -png -r 100 -l 12 ${JSON.stringify(filepath)} ${JSON.stringify(prefix)}`,
      { maxBuffer: 64 * 1024 * 1024 },
    );
    const files = (await readdir(wd)).filter((f) => f.endsWith(".png")).sort();
    const dataUrls = [];
    for (const f of files) {
      const buf = await readFile(join(wd, f));
      dataUrls.push(`data:image/png;base64,${buf.toString("base64")}`);
    }
    const r = await callAI(vision, [
      { role: "system", content: SYSTEM_PARSER },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `【家庭成员】${member.name}（${member.age}岁）\n\n附图为体检报告扫描页。`,
          },
          ...dataUrls.map((u) => ({
            type: "image_url",
            image_url: { url: u, detail: "high" },
          })),
        ],
      },
    ]);
    console.log(
      `     ↳ vision OCR · ${files.length} pages · ${r.elapsed}s · tokens=${r.usage?.total_tokens}`,
    );
    return { parsed: parseJsonLoose(r.content), ocrUsed: true };
  } finally {
    await rm(wd, { recursive: true, force: true }).catch(() => {});
  }
}

async function deriveProfile(member, reports) {
  const memberLines = [`${member.name}（${member.age}岁）`];
  if (member.profile.healthFlags?.length)
    memberLines.push(`已知健康：${member.profile.healthFlags.join(" / ")}`);
  if (member.profile.intolerances?.length)
    memberLines.push(`不耐：${member.profile.intolerances.join(" / ")}`);
  if (member.profile.goals?.length)
    memberLines.push(`目标：${member.profile.goals.join(" / ")}`);
  if (member.profile.preferences?.length)
    memberLines.push(`偏好：${member.profile.preferences.join(" / ")}`);

  const indicatorLines = [];
  for (const r of reports) {
    if (r.abnormal_summary?.length)
      indicatorLines.push(`异常项：${r.abnormal_summary.join("；")}`);
    for (const [cat, items] of Object.entries(r.indicators ?? {})) {
      if (!items) continue;
      for (const [k, v] of Object.entries(items)) {
        const flag = v?.abnormal ? " ⚠️" : "";
        indicatorLines.push(
          `${cat}/${k}: ${v?.value ?? ""}${v?.unit ? " " + v.unit : ""}${flag}`,
        );
      }
    }
  }

  const r = await callAI(primary, [
    { role: "system", content: SYSTEM_PRESCRIBER },
    {
      role: "user",
      content: `【家庭成员】\n${memberLines.join("\n")}\n\n【最新体检指标摘要】\n${indicatorLines.join("\n")}\n\n请输出饮食处方 JSON。`,
    },
  ]);
  console.log(
    `     ↳ profile · ${r.elapsed}s · tokens=${r.usage?.total_tokens}`,
  );
  return parseJsonLoose(r.content);
}

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
  `select id, name, age, role, profile from family_members
   order by case role when 'yeye' then 1 when 'nainai' then 2 when 'baba' then 3 when 'mama' then 4 when 'baby' then 5 end`,
);
const memberByRole = new Map(members.map((m) => [m.role, m]));

const files = (await readdir(dir))
  .filter((f) => f.toLowerCase().endsWith(".pdf"));

console.log(`→ found ${files.length} PDF(s) in ${dir}\n`);

const startedAt = Date.now();
let successes = 0;
let failures = 0;

for (const f of files) {
  const role = guessRole(f);
  const member = role ? memberByRole.get(role) : null;
  if (!member) {
    console.log(`✗ ${f}: cannot map to a family member, skipping`);
    failures++;
    continue;
  }
  console.log(`▶ ${f}  →  ${member.name}`);
  try {
    const filepath = join(dir, f);
    const fileSize = (await stat(filepath)).size;
    // Detect text vs scan
    const { stdout } = await execp(
      `pdftotext -layout ${JSON.stringify(filepath)} -`,
      { maxBuffer: 32 * 1024 * 1024 },
    );
    const cleaned = stdout.replace(/\s+/g, " ").trim();
    const useText = cleaned.length >= 80;
    const { parsed, ocrUsed } = useText
      ? await parseReportFromText(filepath, member)
      : await parseReportFromImages(filepath, member);

    // Insert
    await client.query(
      `delete from health_reports where storage_path = $1`,
      [filepath],
    );
    await client.query(
      `insert into health_reports (member_id, year, storage_path, ocr_used, parsed)
       values ($1, $2, $3, $4, $5::jsonb)`,
      [
        member.id,
        parsed.reportYear ?? null,
        filepath,
        ocrUsed,
        JSON.stringify(parsed),
      ],
    );
    const abnormalCount = parsed.abnormal_summary?.length ?? 0;
    console.log(
      `  ✓ saved · ${(fileSize / 1024).toFixed(0)} KB · ${abnormalCount} abnormal items`,
    );
    successes++;
  } catch (e) {
    console.log(`  ✗ failed: ${e.message}`);
    failures++;
  }
  console.log("");
}

console.log("=== deriving dietary profiles ===\n");
for (const m of members) {
  const { rows: reports } = await client.query(
    `select parsed from health_reports where member_id = $1 order by created_at`,
    [m.id],
  );
  if (reports.length === 0) {
    console.log(`▶ ${m.name}: no reports, skipping profile`);
    continue;
  }
  console.log(`▶ ${m.name}: ${reports.length} report(s)`);
  try {
    const allParsed = reports.map((r) => r.parsed);
    const profile = await deriveProfile(m, allParsed);
    const { rows: maxV } = await client.query(
      `select max(version) as max from dietary_profiles where member_id = $1`,
      [m.id],
    );
    const nextVer = (maxV[0]?.max ?? 0) + 1;
    await client.query(
      `insert into dietary_profiles (member_id, version, tags, recommend, avoid, rationale)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        m.id,
        nextVer,
        profile.tags ?? [],
        profile.recommend ?? [],
        profile.avoid ?? [],
        profile.rationale ?? null,
      ],
    );
    console.log(`  ✓ profile v${nextVer} · tags: ${(profile.tags ?? []).join(", ")}`);
  } catch (e) {
    console.log(`  ✗ profile failed: ${e.message}`);
  }
  console.log("");
}

const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
console.log(`done · ${successes} ok / ${failures} failed · ${elapsed}s total`);
await client.end();
