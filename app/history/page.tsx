import Link from "next/link";
import { RouteGuard } from "@/components/route-guard";

export default function HistoryPage() {
  return (
    <RouteGuard>
      <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
        <section className="mx-auto max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">Người dùng</p>
          <h1 className="mt-3 text-3xl font-semibold">Lịch sử làm bài</h1>
          <p className="mt-4 text-slate-400">Dữ liệu lượt thi sẽ được triển khai từ Phase 9.</p>
          <Link className="mt-8 inline-block text-emerald-300 hover:text-emerald-200" href="/">
            ← Về trang chủ
          </Link>
        </section>
      </main>
    </RouteGuard>
  );
}
