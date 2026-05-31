import { getFromR2 } from "@/lib/r2";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ weekStart: string }> },
) {
  const { weekStart } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return new Response("invalid weekStart", { status: 400 });
  }
  const key = `menu-boards/${weekStart}_week.png`;
  const obj = await getFromR2(key);
  if (!obj) return new Response("not found", { status: 404 });

  return new Response(obj.body, {
    status: 200,
    headers: {
      "Content-Type": obj.httpMetadata?.contentType ?? "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
