import Link from "next/link";
import { RouteGuard } from "@/components/route-guard";

export default function HistoryPage() {
  return (
    <RouteGuard>
      <main className="min-h-screen px-6 py-16 text-foreground">
        <section className="mx-auto max-w-4xl rounded-3xl border border-border bg-surface p-8 shadow-[0_18px_50px_rgba(var(--shadow),0.08)]">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Người dùng</p>
          <h1 className="mt-3 text-3xl font-semibold">Lịch sử làm bài</h1>
          <p className="mt-4 text-muted">Lịch sử và kết quả các lượt thi của bạn sẽ xuất hiện tại đây.</p>
          <Link className="mt-8 inline-block text-accent hover:text-accent-strong" href="/">
            ← Về trang chủ
          </Link>
        </section>
      </main>
    </RouteGuard>
  );
}
