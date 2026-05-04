import Link from "next/link";

const NAV = [
  { href: "/mama", label: "本周菜单" },
  { href: "/mama/history", label: "历史" },
  { href: "/mama/trend", label: "营养趋势" },
  { href: "/mama/family", label: "家庭档案" },
  { href: "/mama/reports", label: "体检报告" },
];

export default function MamaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← 首页
          </Link>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-lg" aria-hidden>
              👩‍💼
            </span>
            <h2 className="font-display text-xl tracking-wide">妈妈</h2>
          </div>
          <span className="text-xs text-muted-foreground">管理 · 审核</span>
        </div>
        <nav className="flex flex-wrap gap-1 border-t border-border/40 px-2 py-1.5 text-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
