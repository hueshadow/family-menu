import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { describeSeasonal } from "@/lib/seasonal";
import { ROLE_DESC, ROLE_LABELS, type Role } from "@/types";

const ROLES: Role[] = ["mama", "naina", "ayi"];

const ROLE_EMOJI: Record<Role, string> = {
  mama: "👩‍💼",
  naina: "👵",
  ayi: "👩‍🍳",
};

export default function Home() {
  const seasonal = describeSeasonal();

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-10 px-6 py-12">
      <header className="space-y-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">🍱 家庭菜单</h1>
        <p className="text-muted-foreground">
          中式 5 口家庭周菜单 · 体检报告驱动的个性化食谱与采购助手
        </p>
        {seasonal ? (
          <p className="rounded-md bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
            🌱 {seasonal}
          </p>
        ) : null}
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {ROLES.map((role) => (
          <Link key={role} href={`/${role}`}>
            <Card className="h-full transition hover:-translate-y-0.5 hover:border-foreground/40 hover:shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <span aria-hidden>{ROLE_EMOJI[role]}</span>
                  <span>{ROLE_LABELS[role]}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {ROLE_DESC[role]}
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <footer className="mt-auto space-y-1 text-center text-xs text-muted-foreground">
        <p>M5 · 自动调度（周日 22:00）+ 时令注入 + 营养趋势</p>
        <p>
          手机入口：
          <code className="mx-1 rounded bg-muted px-1.5 py-0.5">
            http://192.168.50.37:3000
          </code>
        </p>
      </footer>
    </main>
  );
}
