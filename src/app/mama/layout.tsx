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
      <header className="flex items-center justify-between border-b px-6 py-4">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回
        </Link>
        <h2 className="text-lg font-semibold">妈妈视图</h2>
        <nav className="flex gap-3 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:underline">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
