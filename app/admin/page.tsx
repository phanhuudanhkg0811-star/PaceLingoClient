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
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">
                PaceLingo Admin
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                Trung tâm quản trị
              </h1>
            </div>
            <ThemeToggle />
          </header>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <Link
              href="/admin/tests"
              className="group rounded-3xl border border-border bg-surface p-7 shadow-[0_18px_50px_rgba(var(--shadow),0.08)] transition hover:-translate-y-1 hover:border-accent/50"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-2xl text-accent-strong">
                ✎
              </span>
              <h2 className="mt-6 text-xl font-bold group-hover:text-accent">
                Test Editor
              </h2>
              <p className="mt-2 leading-7 text-muted">
                Preview, sửa câu hỏi, gắn media, căn timeline và publish đề.
              </p>
            </Link>
            <Link
              href="/admin/media"
              className="group rounded-3xl border border-border bg-surface p-7 shadow-[0_18px_50px_rgba(var(--shadow),0.08)] transition hover:-translate-y-1 hover:border-accent/50"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-2xl">
                ▧
              </span>
              <h2 className="mt-6 text-xl font-bold group-hover:text-accent">
                Thư viện Media
              </h2>
              <p className="mt-2 leading-7 text-muted">
                Upload, nghe thử, xem ảnh và quản lý tất cả tài nguyên của đề
                TOEIC.
              </p>
            </Link>

            <Link
              href="/admin/directions"
              className="group rounded-3xl border border-border bg-surface p-7 shadow-[0_18px_50px_rgba(var(--shadow),0.08)] transition hover:-translate-y-1 hover:border-accent/50"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-2xl text-accent-strong">
                ▶
              </span>
              <h2 className="mt-6 text-xl font-bold group-hover:text-accent">
                Direction Templates
              </h2>
              <p className="mt-2 leading-7 text-muted">
                Quản lý hướng dẫn, audio và example độc lập cho từng Part của
                bài thi.
              </p>
            </Link>

            <Link
              href="/admin/imports"
              className="group rounded-3xl border border-border bg-surface p-7 shadow-[0_18px_50px_rgba(var(--shadow),0.08)] transition hover:-translate-y-1 hover:border-accent/50"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-2xl text-accent-strong">
                {"{}"}
              </span>
              <h2 className="mt-6 text-xl font-bold group-hover:text-accent">
                Import JSON
              </h2>
              <p className="mt-2 leading-7 text-muted">
                Parse, kiểm tra và chuyển đề từ JSON thành bản nháp có thể chỉnh
                sửa.
              </p>
            </Link>
          </div>

          <Link
            href="/"
            className="mt-8 inline-flex text-sm font-semibold text-accent hover:text-accent-strong"
          >
            ← Về trang chủ
          </Link>
        </section>
      </main>
    </RouteGuard>
  );
}
