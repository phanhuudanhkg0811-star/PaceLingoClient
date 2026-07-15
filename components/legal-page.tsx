import Link from "next/link";
import { SiteFooter } from "./site-footer";

export function LegalPage({ title, updatedAt, children }: { title: string; updatedAt: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface/80">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-5 sm:px-8">
          <Link href="/" aria-label="Quay lại" className="grid size-9 place-items-center rounded-xl border border-border">←</Link>
          <strong>Pace<span className="text-accent">Lingo</span></strong>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-accent-strong">Legal</p>
        <h1 className="mt-3 text-3xl font-black sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-muted">Cập nhật lần cuối: {updatedAt}</p>
        <div className="mt-10 space-y-8 text-[15px] leading-7 text-muted [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-black [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">{children}</div>
      </article>
      <SiteFooter />
    </main>
  );
}
