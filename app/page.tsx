import Link from "next/link";
import { AuthActions } from "@/components/auth-actions";
import { ThemeToggle } from "@/components/theme-toggle";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-foreground">
      <div className="relative w-full max-w-3xl rounded-3xl border border-border bg-surface/90 p-8 shadow-[0_24px_70px_rgba(var(--shadow),0.12)] backdrop-blur">
        <div className="absolute right-6 top-6"><ThemeToggle /></div>
        <p className="mb-3 pr-14 text-sm font-semibold uppercase tracking-[0.3em] text-accent">
          PaceLingo foundation
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Luyện TOEIC đúng nhịp, tiến bộ đúng hướng.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          Nền tảng frontend, backend và phiên đăng nhập Google đã sẵn sàng cho hành trình luyện thi của bạn.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface-raised p-5">
            <h2 className="text-lg font-medium">Trạng thái hệ thống</h2>
            <p className="mt-2 text-sm text-muted">
              API health: <span className="font-mono text-accent">{apiUrl}/health</span>
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-raised p-5">
            <h2 className="text-lg font-medium">Bước tiếp theo</h2>
            <p className="mt-2 text-sm text-muted">
              Xây dựng dữ liệu đề thi TOEIC Part 1–7 trong Phase 3.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <AuthActions />
          <Link
            href="/history"
            className="rounded-full border border-border px-5 py-2.5 text-sm font-medium transition hover:border-accent/50"
          >
            Xem lịch sử
          </Link>
          <Link
            href="/tests"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white dark:text-slate-950"
          >
            Vào phòng thi
          </Link>
          <a
            href={`${apiUrl}/health`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-border px-5 py-2.5 text-sm font-medium transition hover:border-accent/50"
          >
            Kiểm tra API
          </a>
        </div>
      </div>
    </main>
  );
}
