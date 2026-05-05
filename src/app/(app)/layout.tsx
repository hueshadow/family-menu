import Link from "next/link";

const NAV = [
  { href: "/", label: "主页" },
  { href: "/shopping", label: "采购清单" },
  { href: "/family", label: "家庭档案" },
  { href: "/trend", label: "营养趋势" },
  { href: "/history", label: "历史" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <Link
            href="/"
            className="flex items-baseline gap-2 transition hover:text-primary"
          >
            <span aria-hidden>🍱</span>
            <span className="font-display text-lg tracking-wide">家庭菜单</span>
          </Link>
          <span className="text-xs text-muted-foreground">
            苏州本帮 · 江浙家常
          </span>
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
