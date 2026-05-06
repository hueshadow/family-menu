import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const execFilep = promisify(execFile);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const EXPORT_ROOT = join(tmpdir(), "family-menu-card-export");
const MAX_DIMENSION = 12_000;
const MAX_PIXELS = 40_000_000;

interface CardExportData {
  html: string;
  width: number;
  height: number;
  scale: number;
  backgroundColor: string;
  filename: string;
  origin: string;
}

export async function POST(req: Request) {
  let data: CardExportData;
  try {
    data = validatePayload(Object.fromEntries(await req.formData()));
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "invalid payload", {
      status: 400,
    });
  }

  const dir = await mkExportDir();
  const htmlPath = join(dir, "card.html");
  const pngPath = join(dir, "card.png");

  try {
    await mkdir(dir, { recursive: true });
    await writeFile(htmlPath, renderHtml(data), "utf8");
    await execFilep(
      CHROME,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--allow-file-access-from-files",
        `--window-size=${data.width * data.scale},${data.height * data.scale}`,
        `--screenshot=${pngPath}`,
        `file://${htmlPath}`,
      ],
      { maxBuffer: 64 * 1024 * 1024 },
    );

    const buf = await readFile(pngPath);
    await saveToDownloads(data.filename, buf);
    await rm(dir, { recursive: true, force: true });
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeRFC5987(data.filename)}`,
      },
    });
  } catch (e) {
    await rm(dir, { recursive: true, force: true });
    return new Response(e instanceof Error ? e.message : "export failed", {
      status: 500,
    });
  }
}

function validatePayload(input: unknown): CardExportData {
  if (!input || typeof input !== "object") {
    throw new Error("invalid payload");
  }

  const data = input as Partial<CardExportData>;
  const width = toInteger(data.width);
  const height = toInteger(data.height);
  const scale = toInteger(data.scale);
  const totalPixels = width * height * scale * scale;

  if (
    !data.html ||
    typeof data.html !== "string" ||
    width < 1 ||
    height < 1 ||
    scale < 1 ||
    scale > 4 ||
    width * scale > MAX_DIMENSION ||
    height * scale > MAX_DIMENSION ||
    totalPixels > MAX_PIXELS
  ) {
    throw new Error("invalid card export size");
  }

  return {
    html: data.html,
    width,
    height,
    scale,
    backgroundColor:
      typeof data.backgroundColor === "string" ? data.backgroundColor : "#fff",
    filename:
      typeof data.filename === "string" ? safeFilename(data.filename) : "菜单卡片.png",
    origin: typeof data.origin === "string" ? data.origin : "",
  };
}

function toInteger(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
  }

  return 0;
}

function renderHtml(data: CardExportData) {
  const viewportWidth = data.width * data.scale;
  const viewportHeight = data.height * data.scale;

  const html = absolutizeRelativeUrls(data.html, data.origin);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; }
  html, body {
    width: ${viewportWidth}px;
    height: ${viewportHeight}px;
    margin: 0;
    overflow: hidden;
    background: ${data.backgroundColor};
  }
  #export-root {
    width: ${data.width}px;
    height: ${data.height}px;
    transform: scale(${data.scale});
    transform-origin: top left;
  }
</style>
</head>
<body>
  <div id="export-root">${html}</div>
</body>
</html>`;
}

async function mkExportDir() {
  await mkdir(EXPORT_ROOT, { recursive: true });
  return join(EXPORT_ROOT, `${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

async function saveToDownloads(filename: string, buf: Buffer) {
  const downloadsDir = join(homedir(), "Downloads");
  await mkdir(downloadsDir, { recursive: true });
  await writeFile(join(downloadsDir, filename), buf);
}

function safeFilename(filename: string) {
  const trimmed = filename.trim().replace(/[\\/:*?"<>|]/g, "-");
  return trimmed.endsWith(".png") ? trimmed : `${trimmed || "菜单卡片"}.png`;
}

function encodeRFC5987(value: string) {
  return encodeURIComponent(value)
    .replace(/['()]/g, escape)
    .replace(/\*/g, "%2A");
}

function absolutizeRelativeUrls(html: string, origin: string) {
  if (!origin) return html;

  return html.replace(/\b(src|href)="(\/[^"]*)"/g, (_match, attr, path) => {
    return `${attr}="${origin}${path}"`;
  });
}
