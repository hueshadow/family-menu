import "server-only";

// =========================================================================
// R2 对象存储工具
// Workers 上通过 @opennextjs/cloudflare 的 getCloudflareContext 拿 binding。
// 本地 dev (next dev) 无 R2 binding 时返回 null / 跳过。
// =========================================================================

const R2_PUBLIC = process.env.R2_PUBLIC_URL ?? "";

/** 动态获取 R2 bucket binding（仅 Workers 环境可用） */
async function getBucket(): Promise<R2Bucket | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    // env is CloudflareEnv — FAMILY_IMAGES is a declared binding
    return (env as unknown as CloudflareEnv).FAMILY_IMAGES ?? null;
  } catch {
    // 本地 dev 无 Cloudflare 运行时 — 降级
    console.warn("[r2] Cloudflare context unavailable, R2 ops will no-op");
    return null;
  }
}

/** 上传 buffer 到 R2，返回公开 URL */
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  const bucket = await getBucket();
  if (bucket) {
    await bucket.put(key, body, {
      httpMetadata: { contentType },
    });
  } else {
    console.warn(`[r2] upload skipped (no bucket): ${key}`);
  }
  return `${R2_PUBLIC}/${key}`;
}

/** 检查 R2 key 是否存在 */
export async function r2Exists(key: string): Promise<boolean> {
  const bucket = await getBucket();
  if (!bucket) return false;
  const obj = await bucket.head(key);
  return obj !== null;
}

/** 获取 R2 对象，不存在返回 null */
export async function getFromR2(key: string): Promise<R2ObjectBody | null> {
  const bucket = await getBucket();
  if (!bucket) return getFromLocalFs(key);
  return bucket.get(key);
}

/**
 * 本地降级：非 Cloudflare 运行时（next dev / next start）没有 R2 binding，
 * 改从仓库内的 family-menu-data/<key> 读取。R2 key 与本地目录结构一致
 * （dish-images/、table-photos/、day-boards/、menu-boards/），所以一处兜底即可。
 * node:fs 用动态 import，避免进入 Workers 打包图。
 */
async function getFromLocalFs(key: string): Promise<R2ObjectBody | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    const { join, normalize } = await import("node:path");
    const base = join(process.cwd(), "family-menu-data");
    const path = normalize(join(base, key));
    // 防目录穿越：解析后必须仍在 base 内
    if (!path.startsWith(base)) return null;
    const buf = await readFile(path);
    const contentType = key.endsWith(".png")
      ? "image/png"
      : key.endsWith(".jpg") || key.endsWith(".jpeg")
        ? "image/jpeg"
        : "application/octet-stream";
    return {
      body: new Uint8Array(buf),
      httpMetadata: { contentType },
    } as unknown as R2ObjectBody;
  } catch {
    return null;
  }
}
