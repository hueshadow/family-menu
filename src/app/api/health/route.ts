export const runtime = "edge";

export function GET() {
  return Response.json({
    ok: true,
    name: "family-menu",
    milestone: "M1",
    timestamp: new Date().toISOString(),
  });
}
