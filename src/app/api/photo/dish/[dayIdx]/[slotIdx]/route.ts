import { getFromR2 } from "@/lib/r2";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ dayIdx: string; slotIdx: string }> },
) {
  const { dayIdx, slotIdx } = await params;
  if (!/^\d+$/.test(dayIdx) || !/^\d+$/.test(slotIdx)) {
    return new Response("invalid params", { status: 400 });
  }

  const key = `dish-images/d${dayIdx}-s${slotIdx}.png`;
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
