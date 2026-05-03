import "server-only";
import { z } from "zod";
import { chatJson, MODELS } from "@/lib/ai-server";
import { extractPdfText, maskPII, renderPdfPages } from "@/lib/pdf";
import type { MemberRow } from "@/lib/shared";

const IndicatorValueSchema = z.object({
  value: z.union([z.string(), z.number()]).optional(),
  unit: z.string().optional(),
  abnormal: z.boolean().optional(),
  note: z.string().optional(),
});

const IndicatorsSchema = z.object({
  代谢: z.record(z.string(), IndicatorValueSchema).optional(),
  血脂: z.record(z.string(), IndicatorValueSchema).optional(),
  血压: z.record(z.string(), IndicatorValueSchema).optional(),
  血常规: z.record(z.string(), IndicatorValueSchema).optional(),
  肝肾: z.record(z.string(), IndicatorValueSchema).optional(),
  甲状腺: z.record(z.string(), IndicatorValueSchema).optional(),
  营养: z.record(z.string(), IndicatorValueSchema).optional(),
  其他: z.record(z.string(), IndicatorValueSchema).optional(),
});

export const HealthReportParsedSchema = z.object({
  reportYear: z.number().int().nullable().optional(),
  indicators: IndicatorsSchema,
  abnormal_summary: z.array(z.string()).default([]),
  raw_observations: z.array(z.string()).default([]),
});
export type HealthReportParsed = z.infer<typeof HealthReportParsedSchema>;

const SYSTEM_PARSER = `你是一位中文医疗体检报告结构化解析助手。任务：从原文中提取与饮食营养相关的指标，输出结构化 JSON。

【提取范围】只关注**饮食营养相关**的项，**忽略**影像 / 心电图 / 体格 / 妇科 / 视力听力等无关项。

类别：
- 代谢：空腹血糖、糖化血红蛋白、尿酸
- 血脂：总胆固醇、HDL、LDL、甘油三酯
- 血压：收缩压、舒张压
- 血常规：血红蛋白、白细胞、血小板、红细胞
- 肝肾：ALT、AST、肌酐、尿素氮、白蛋白
- 甲状腺：TSH、T3/FT3、T4/FT4
- 营养：维生素 D、维生素 B12、铁、钙、铁蛋白
- 其他：仅当与饮食强相关（如尿微量白蛋白、同型半胱氨酸等）

【输出 JSON 严格格式】（仅 JSON，无任何 markdown 或额外文字）：
{
  "reportYear": 年份数字 或 null,
  "indicators": {
    "代谢": { "空腹血糖": {"value": 5.6, "unit": "mmol/L", "abnormal": false}, ... },
    "血脂": { "LDL": {"value": 3.8, "unit": "mmol/L", "abnormal": true, "note": "偏高"}, ... },
    "血压": { "收缩压": {"value": 138, "unit": "mmHg", "abnormal": true}, "舒张压": {...} },
    ...其它类别按需...
  },
  "abnormal_summary": ["LDL 3.8 mmol/L 偏高", "..."],
  "raw_observations": ["医生建议清淡饮食", "..."]
}

未提及的指标 / 类别请省略字段，不要瞎编。abnormal_summary 只列**异常或临界**的指标。`;

const DietaryProfileOutputSchema = z.object({
  tags: z.array(z.string()).default([]),
  recommend: z.array(z.string()).default([]),
  avoid: z.array(z.string()).default([]),
  rationale: z.string().optional(),
});
export type DietaryProfileOutput = z.infer<typeof DietaryProfileOutputSchema>;

const SYSTEM_PRESCRIBER = `你是一位中医营养师，依据体检指标 + 家庭成员基础情况，输出**饮食处方**（用于指导日常菜单生成）。

要求：
1. 只输出**与饮食强相关**的建议；非饮食类（运动 / 用药 / 复查）不在此处。
2. 推荐与忌口要**具体可执行**（食材级别、烹饪法、份量提示），避免空话。
3. 优先**清淡 / 易消化 / 高蛋白**风格，符合江浙苏州家常菜可落地的范围。
4. tags：用 3-6 个中文短词概括，如 "高血压"、"血脂偏高"、"奶奶易消化"、"减脂"、"补铁" 等。

输出严格 JSON：
{
  "tags": ["..."],
  "recommend": ["..."],
  "avoid": ["..."],
  "rationale": "（一句话总结依据）"
}`;

export async function parseHealthReportFromFile(
  filepath: string,
  memberHint: { name: string; age: number },
): Promise<HealthReportParsed> {
  const text = await extractPdfText(filepath);
  if (text) {
    const masked = maskPII(text);
    const userMsg = `【家庭成员】${memberHint.name}（${memberHint.age}岁）

【报告原文（已脱敏）】
${masked.slice(0, 30000)}`;
    const raw = await chatJson<unknown>({
      model: MODELS.primary,
      system: SYSTEM_PARSER,
      user: userMsg,
    });
    return HealthReportParsedSchema.parse(raw);
  }

  // OCR via vision
  const dataUrls = await renderPdfPages(filepath, { dpi: 100, maxPages: 12 });
  const userText = `【家庭成员】${memberHint.name}（${memberHint.age}岁）

附图为体检报告扫描页，请识别并提取饮食相关指标。`;
  const messages = [
    { role: "system", content: SYSTEM_PARSER },
    {
      role: "user",
      content: [
        { type: "text", text: userText },
        ...dataUrls.map((url) => ({
          type: "image_url",
          image_url: { url, detail: "high" },
        })),
      ],
    },
  ];
  const baseURL = process.env.AI_BASE_URL!;
  const apiKey = process.env.AI_API_KEY!;
  const res = await fetch(`${baseURL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODELS.vision, messages }),
  });
  if (!res.ok) {
    throw new Error(`vision ${res.status}: ${await res.text().then((t) => t.slice(0, 300))}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("vision response missing content");
  }
  const parsed = parseLooseJson(content);
  return HealthReportParsedSchema.parse(parsed);
}

function parseLooseJson(text: string): unknown {
  try {
    return JSON.parse(text.trim());
  } catch {
    /* fall through */
  }
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return JSON.parse(fence[1].trim());
  const f = text.indexOf("{");
  const l = text.lastIndexOf("}");
  if (f >= 0 && l > f) return JSON.parse(text.slice(f, l + 1));
  throw new Error(`unparseable: ${text.slice(0, 200)}`);
}

export async function deriveDietaryProfile(opts: {
  member: MemberRow;
  reports: HealthReportParsed[];
}): Promise<DietaryProfileOutput> {
  const memberLines: string[] = [
    `${opts.member.name}（${opts.member.age}岁）`,
  ];
  if (opts.member.profile.healthFlags?.length)
    memberLines.push(`已知健康：${opts.member.profile.healthFlags.join(" / ")}`);
  if (opts.member.profile.intolerances?.length)
    memberLines.push(`不耐：${opts.member.profile.intolerances.join(" / ")}`);
  if (opts.member.profile.goals?.length)
    memberLines.push(`目标：${opts.member.profile.goals.join(" / ")}`);
  if (opts.member.profile.preferences?.length)
    memberLines.push(`偏好：${opts.member.profile.preferences.join(" / ")}`);

  const indicatorLines: string[] = [];
  for (const r of opts.reports) {
    if (r.abnormal_summary.length) {
      indicatorLines.push(`异常项：${r.abnormal_summary.join("；")}`);
    }
    for (const [cat, items] of Object.entries(r.indicators ?? {})) {
      if (!items) continue;
      for (const [k, v] of Object.entries(items)) {
        const value = v?.value ?? "";
        const unit = v?.unit ?? "";
        const flag = v?.abnormal ? " ⚠️" : "";
        indicatorLines.push(`${cat}/${k}: ${value}${unit ? " " + unit : ""}${flag}`);
      }
    }
    if (r.raw_observations.length) {
      indicatorLines.push(`其他：${r.raw_observations.join("；")}`);
    }
  }

  const userMsg = `【家庭成员】
${memberLines.join("\n")}

【最新体检指标摘要】
${indicatorLines.length ? indicatorLines.join("\n") : "（无异常或无相关指标）"}

请输出饮食处方 JSON。`;

  const raw = await chatJson<unknown>({
    model: MODELS.primary,
    system: SYSTEM_PRESCRIBER,
    user: userMsg,
  });
  return DietaryProfileOutputSchema.parse(raw);
}
