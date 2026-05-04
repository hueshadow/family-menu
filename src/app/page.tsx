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
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-10 px-6 py-14">
      <header className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-1 text-xs tracking-widest text-muted-foreground">
          <span aria-hidden>🍱</span>
          <span>苏州本帮 · 江浙家常</span>
        </div>
        <h1 className="font-display text-5xl tracking-tight text-foreground">
          家 庭 菜 单
        </h1>
        <p className="text-sm text-muted-foreground">
          中式 5 口家庭周菜单 · 体检报告驱动的个性化食谱与采购助手
        </p>
        {seasonal ? (
          <p className="mx-auto max-w-xl rounded-lg border border-border/60 bg-card/60 px-4 py-2 text-xs leading-relaxed text-muted-foreground">
            🌱 {seasonal}
          </p>
        ) : null}
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {ROLES.map((role) => (
          <Link key={role} href={`/${role}`} className="group">
            <Card className="relative h-full overflow-hidden border-border/70 bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg">
              <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0 opacity-0 transition-opacity group-hover:opacity-100" />
              <CardHeader>
                <CardTitle className="flex items-baseline gap-3 text-2xl">
                  <span className="text-3xl" aria-hidden>
                    {ROLE_EMOJI[role]}
                  </span>
                  <span className="font-display">{ROLE_LABELS[role]}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-muted-foreground">
                {ROLE_DESC[role]}
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <footer className="mt-auto space-y-1 text-center text-xs text-muted-foreground/70">
        <p>自动调度 · 周日 22:00 出下周菜单</p>
      </footer>
    </main>
  );
}
