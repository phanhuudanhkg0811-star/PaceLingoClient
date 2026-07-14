import Link from "next/link";
import { RouteGuard } from "@/components/route-guard";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AdminPage() {
  return (
    <RouteGuard admin>
      <main className="min-h-screen px-5 py-8 sm:px-8">
        <section className="mx-auto max-w-6xl">
          <header className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">PaceLingo Admin</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Trung tâm quản trị</h1>
            </div>
            <ThemeToggle />
          </header>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <Link
              href="/admin/media"
              className="group rounded-3xl border border-border bg-surface p-7 shadow-[0_18px_50px_rgba(var(--shadow),0.08)] transition hover:-translate-y-1 hover:border-accent/50"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-2xl">▧</span>
              <h2 className="mt-6 text-xl font-bold group-hover:text-accent">Thư viện Media</h2>
              <p className="mt-2 leading-7 text-muted">
                Upload, nghe thử, xem ảnh và quản lý tất cả tài nguyên của đề TOEIC.
              </p>
            </Link>

            <div className="rounded-3xl border border-dashed border-border bg-surface/60 p-7">
              <span className="grid size-12 place-items-center rounded-2xl bg-surface-raised text-2xl">✎</span>
              <h2 className="mt-6 text-xl font-bold">Test Editor</h2>
              <p className="mt-2 leading-7 text-muted">Sẽ được nối với import và editor trong Phase 6–7.</p>
            </div>
          </div>

          <Link href="/" className="mt-8 inline-flex text-sm font-semibold text-accent hover:text-accent-strong">
            ← Về trang chủ
          </Link>
        </section>
      </main>
    </RouteGuard>
  );
}
