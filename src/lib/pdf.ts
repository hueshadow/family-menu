import "server-only";
import { exec } from "node:child_process";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execp = promisify(exec);

/**
 * Extract text using poppler `pdftotext`. Returns null if no usable text
 * (likely a scanned PDF that needs OCR).
 */
export async function extractPdfText(filepath: string): Promise<string | null> {
  const { stdout } = await execp(
    `pdftotext -layout ${JSON.stringify(filepath)} -`,
    { maxBuffer: 32 * 1024 * 1024 },
  );
  const cleaned = stdout.replace(/\s+/g, " ").trim();
  if (cleaned.length < 80) return null;
  return stdout;
}

/**
 * Convert each PDF page to a PNG via poppler `pdftoppm`. Returns base64 data URLs.
 * Resolution kept modest (100 DPI) to balance OCR readability vs vision model cost.
 */
export async function renderPdfPages(
  filepath: string,
  opts: { dpi?: number; maxPages?: number } = {},
): Promise<string[]> {
  const dpi = opts.dpi ?? 100;
  const maxPages = opts.maxPages ?? 12;
  const dir = await mkdir(join(tmpdir(), `fmp-${Date.now()}`), {
    recursive: true,
  });
  const workDir = dir!;
  const prefix = join(workDir, "page");
  try {
    await execp(
      `pdftoppm -png -r ${dpi} -l ${maxPages} ${JSON.stringify(filepath)} ${JSON.stringify(prefix)}`,
      { maxBuffer: 64 * 1024 * 1024 },
    );
    const files = (await readdir(workDir))
      .filter((f) => f.endsWith(".png"))
      .sort();
    const dataUrls: string[] = [];
    for (const f of files) {
      const buf = await readFile(join(workDir, f));
      dataUrls.push(`data:image/png;base64,${buf.toString("base64")}`);
    }
    return dataUrls;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function getPdfPageCount(filepath: string): Promise<number> {
  const { stdout } = await execp(
    `pdfinfo ${JSON.stringify(filepath)} | grep -E '^Pages:'`,
  ).catch(() => ({ stdout: "" }));
  const m = stdout.match(/Pages:\s+(\d+)/);
  return m ? Number(m[1]) : 0;
}

const PII_PATTERNS: Array<[RegExp, string]> = [
  [/[一-龥]{2,4}先生|[一-龥]{2,4}女士/g, "[姓名]"],
  [/姓\s*名[：: ]+\S+/g, "姓名: [姓名]"],
  [/(身份证号?|证件号?|ID)[：: ]*[\dXx]{15,18}/g, "身份证: [已脱敏]"],
  [/\b\d{17}[\dXx]\b/g, "[身份证号]"],
  [/\b1[3-9]\d{9}\b/g, "[手机]"],
  [/(电话|联系电话|手机)[：: ]*\d{7,11}/g, "电话: [已脱敏]"],
  [/(医保号|社保号|病案号|住院号|门诊号|患者编号)[：: ]*\S+/g, "[已脱敏]"],
];

export function maskPII(text: string): string {
  let out = text;
  for (const [re, repl] of PII_PATTERNS) {
    out = out.replace(re, repl);
  }
  return out;
}
