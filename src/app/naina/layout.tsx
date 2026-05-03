import Link from "next/link";

export default function NainaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col text-lg">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <Link href="/" className="text-base text-muted-foreground hover:text-foreground">
          ← 返回
        </Link>
        <h2 className="text-xl font-semibold">奶奶 · 采购</h2>
        <span aria-hidden className="w-12" />
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
