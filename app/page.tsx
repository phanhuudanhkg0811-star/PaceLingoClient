import Link from "next/link";
import { AuthActions } from "@/components/auth-actions";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 py-16 text-slate-100">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-black/20">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">
          PaceLingo foundation
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Luyện TOEIC đúng nhịp, tiến bộ đúng hướng.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-300">
          Nền tảng frontend, backend và phiên đăng nhập Google đã sẵn sàng cho hành trình luyện thi của bạn.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
            <h2 className="text-lg font-medium">Trạng thái hệ thống</h2>
            <p className="mt-2 text-sm text-slate-400">
              API health: <span className="font-mono text-emerald-300">{apiUrl}/health</span>
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5">
            <h2 className="text-lg font-medium">Bước tiếp theo</h2>
            <p className="mt-2 text-sm text-slate-400">
              Xây dựng dữ liệu đề thi TOEIC Part 1–7 trong Phase 3.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <AuthActions />
          <Link
            href="/history"
            className="rounded-full border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500"
          >
            Xem lịch sử
          </Link>
          <a
            href={`${apiUrl}/health`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500"
          >
            Kiểm tra API
          </a>
        </div>
      </div>
    </main>
  );
}
