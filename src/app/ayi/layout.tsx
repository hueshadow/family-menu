import Link from "next/link";

export default function AyiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← 首页
          </Link>
          <div className="flex items-baseline gap-2">
            <span className="text-lg" aria-hidden>👩‍🍳</span>
            <h2 className="font-display text-xl tracking-wide">
              阿姨 · 今日做菜
            </h2>
          </div>
          <span aria-hidden className="w-10" />
        </div>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
