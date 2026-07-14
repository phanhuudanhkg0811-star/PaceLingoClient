import Link from "next/link";
import { RouteGuard } from "@/components/route-guard";

export default function AdminPage() {
  return (
    <RouteGuard admin>
      <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
        <section className="mx-auto max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-amber-400">Admin only</p>
          <h1 className="mt-3 text-3xl font-semibold">Quản trị PaceLingo</h1>
          <p className="mt-4 text-slate-400">Khu vực quản lý đề thi sẽ được mở rộng trong các phase tiếp theo.</p>
          <Link className="mt-8 inline-block text-emerald-300 hover:text-emerald-200" href="/">
            ← Về trang chủ
          </Link>
        </section>
      </main>
    </RouteGuard>
  );
}
