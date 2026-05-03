import Link from "next/link";

export default function AyiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回
        </Link>
        <h2 className="text-lg font-semibold">阿姨 · 今日做菜</h2>
        <span aria-hidden className="w-10" />
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
