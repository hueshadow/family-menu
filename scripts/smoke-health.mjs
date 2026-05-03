// Smoke test: parse a real PDF report end-to-end (text path).
// Usage: npm run smoke:health [filename]

import { exec } from "node:child_process";
import { promisify } from "node:util";

const execp = promisify(exec);

const baseURL = process.env.AI_BASE_URL;
const apiKey = process.env.AI_API_KEY;
const model = process.env.AI_MODEL_PRIMARY || "gpt-5.5";
const dir = process.env.HEALTH_REPORTS_DIR;

import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const arg = process.argv[2] || "妈妈体检报告.pdf";
const filepath = `${dir}/${arg}`;
const visionModel = process.env.AI_MODEL_VISION || "gpt-4o";

const SYSTEM = `你是一位中文医疗体检报告结构化解析助手。任务：从原文中提取与饮食营养相关的指标，输出结构化 JSON。

类别：代谢、血脂、血压、血常规、肝肾、甲状腺、营养、其他。
忽略影像 / 心电图 / 体格 / 妇科 / 视力听力等非饮食项。

输出 JSON 严格格式（仅 JSON）：
{
  "reportYear": 数字 或 null,
  "indicators": {
    "代谢": { "空腹血糖": {"value": 5.6, "unit": "mmol/L", "abnormal": false}, ... },
    ...
  },
  "abnormal_summary": ["..."],
  "raw_observations": ["..."]
}`;

const PII = [
  [/[一-龥]{2,4}先生|[一-龥]{2,4}女士/g, "[姓名]"],
  [/姓\s*名[：: ]+\S+/g, "姓名: [姓名]"],
  [/(身份证号?|证件号?)[：: ]*[\dXx]{15,18}/g, "身份证: [已脱敏]"],
  [/\b\d{17}[\dXx]\b/g, "[身份证号]"],
  [/\b1[3-9]\d{9}\b/g, "[手机]"],
];

console.log("→ extracting text from", arg);
const { stdout } = await execp(`pdftotext -layout ${JSON.stringify(filepath)} -`, {
  maxBuffer: 32 * 1024 * 1024,
});
let masked = stdout;
for (const [re, repl] of PII) masked = masked.replace(re, repl);
const cleaned = masked.replace(/\s+/g, " ").trim();
console.log(`  ${cleaned.length} chars`);

let body;
let usedModel;
if (cleaned.length >= 80) {
  usedModel = model;
  body = {
    model,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `【家庭成员】${arg}（待识别）\n\n【报告原文（已脱敏）】\n${masked.slice(0, 30000)}`,
      },
    ],
  };
} else {
  console.log("→ scanned PDF, rendering pages via pdftoppm…");
  const wd = join(tmpdir(), `fmh-${Date.now()}`);
  await mkdir(wd, { recursive: true });
  const prefix = join(wd, "page");
  await execp(`pdftoppm -png -r 100 -l 12 ${JSON.stringify(filepath)} ${JSON.stringify(prefix)}`, { maxBuffer: 64 * 1024 * 1024 });
  const files = (await readdir(wd)).filter((f) => f.endsWith(".png")).sort();
  console.log(`  ${files.length} pages rendered`);
  const dataUrls = [];
  for (const f of files) {
    const buf = await readFile(join(wd, f));
    dataUrls.push(`data:image/png;base64,${buf.toString("base64")}`);
  }
  await rm(wd, { recursive: true, force: true });
  usedModel = visionModel;
  body = {
    model: visionModel,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: `【家庭成员】${arg}（待识别）\n\n附图为体检报告扫描页。` },
          ...dataUrls.map((u) => ({ type: "image_url", image_url: { url: u, detail: "high" } })),
        ],
      },
    ],
  };
}

console.log(`→ calling ${usedModel}`);
const t0 = Date.now();
const res = await fetch(`${baseURL}/v1/chat/completions`, {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const elapsed = Date.now() - t0;
const data = await res.json();
console.log(`← ${res.status} in ${elapsed}ms`, data.usage);

const content = data.choices?.[0]?.message?.content ?? "";
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
console.log("---");
console.log("Year:", parsed.reportYear);
console.log("Categories:", Object.keys(parsed.indicators || {}));
console.log("Abnormal:", parsed.abnormal_summary);
const allItems = [];
for (const [cat, items] of Object.entries(parsed.indicators || {})) {
  for (const [k, v] of Object.entries(items || {})) {
    const flag = v.abnormal ? " ⚠️" : "";
    allItems.push(`  ${cat}/${k}: ${v.value ?? ""}${v.unit ? " " + v.unit : ""}${flag}`);
  }
}
console.log("All indicators:");
console.log(allItems.join("\n"));
