"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/auth-client";
import type { AttemptHistoryItem } from "@/lib/review-types";
import { ThemeToggle } from "./theme-toggle";

export function AttemptHistory() {
  const [attempts, setAttempts] = useState<AttemptHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/attempts")
      .then(async (response) => {
        if (!response.ok) throw new Error(`Không tải được lịch sử (${response.status})`);
        setAttempts((await response.json()) as AttemptHistoryItem[]);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Không tải được lịch sử"),
      )
      .finally(() => setLoading(false));
  }, []);

  const completed = attempts.filter((attempt) => attempt.status !== "IN_PROGRESS");
  const bestRaw = completed.reduce(
    (best, attempt) => Math.max(best, attempt.result?.correctCount ?? 0),
    0,
  );

  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-5 text-foreground sm:px-8 sm:pt-7">
      <div className="mx-auto max-w-6xl">
        <nav className="flex items-center justify-between">
          <Link href="/" aria-label="Quay lại" className="grid size-11 place-items-center rounded-2xl border border-border bg-surface shadow-sm transition hover:border-accent/40 hover:text-accent-strong"><BackIcon /></Link>
          <ThemeToggle />
        </nav>

        <header className="mt-7 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#061d42] via-[#07386d] to-[#0868ae] px-6 py-9 text-white shadow-[0_24px_70px_rgba(3,31,72,0.2)] sm:px-10">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-300">Your progress</p>
          <div className="mt-3 flex flex-col gap-7 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-black sm:text-5xl">Lịch sử làm bài</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/85">Mỗi lượt thi được lưu riêng để bạn xem lại lỗi sai và luyện lại đúng phần còn yếu.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <HistoryStat value={attempts.length} label="Lượt thi" />
              <HistoryStat value={completed.length} label="Hoàn thành" />
              <HistoryStat value={bestRaw || "—"} label="Đúng cao nhất" />
            </div>
          </div>
        </header>

        <section className="mt-9">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-accent-strong">Attempts</p>
              <h2 className="mt-1 text-2xl font-black">Các lượt gần đây</h2>
            </div>
            <Link href="/tests" className="rounded-xl bg-accent px-4 py-2.5 text-sm font-black text-white transition hover:bg-accent-strong">Làm đề mới</Link>
          </div>

          {loading && <HistorySkeleton />}
          {error && <p className="mt-6 rounded-2xl bg-danger-soft p-5 font-semibold text-danger">{error}</p>}
          {!loading && !error && attempts.length === 0 && (
            <div className="mt-6 rounded-[2rem] border border-dashed border-border bg-surface p-12 text-center">
              <h3 className="text-lg font-black">Bạn chưa có lượt thi nào</h3>
              <p className="mt-2 text-sm text-muted">Chọn một đề để bắt đầu ghi lại tiến độ.</p>
              <Link href="/tests" className="mt-6 inline-flex rounded-xl bg-accent px-5 py-3 text-sm font-black text-white">Chọn đề thi</Link>
            </div>
          )}

          <div className="mt-6 space-y-4">
            {attempts.map((attempt) => <HistoryCard key={attempt.id} attempt={attempt} />)}
          </div>
        </section>
      </div>
    </main>
  );
}

function HistoryCard({ attempt }: { attempt: AttemptHistoryItem }) {
  const inProgress = attempt.status === "IN_PROGRESS";
  const result = attempt.result;
  return (
    <article className="grid gap-5 rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:border-accent/30 md:grid-cols-[1fr_auto] md:items-center sm:p-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={attempt.status} />
          <span className="text-xs font-bold text-muted">Version {attempt.testVersion.version}</span>
          <span className="text-xs text-muted">· {formatDate(attempt.startedAt)}</span>
        </div>
        <h3 className="mt-3 truncate text-xl font-black">{attempt.test.title}</h3>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          {result ? (
            <>
              <Metric label="Tổng đúng" value={`${result.correctCount}/${result.questionCount}`} />
              {result.score.listening.total > 0 && <Metric label="Listening" value={`${result.score.listening.correct}/${result.score.listening.total}`} />}
              {result.score.reading.total > 0 && <Metric label="Reading" value={`${result.score.reading.correct}/${result.score.reading.total}`} />}
              <Metric label="Thời gian" value={formatDuration(result.durationMs)} />
              {result.score.totalScaled !== null && <Metric label="Điểm quy đổi" value={String(result.score.totalScaled)} />}
            </>
          ) : (
            <Metric label="Tiến độ đã lưu" value={`${attempt._count.answers} câu`} />
          )}
        </div>
      </div>
      <div className="flex gap-2 md:justify-end">
        {inProgress ? (
          <Link href={`/exam/${attempt.test.id}`} className="flex-1 rounded-xl bg-accent px-5 py-3 text-center text-sm font-black text-white md:flex-none">Tiếp tục làm</Link>
        ) : (
          <>
            <Link href={`/exam/${attempt.test.id}`} className="rounded-xl border border-border px-4 py-3 text-sm font-bold transition hover:border-accent/40 hover:text-accent-strong">Làm lại</Link>
            <Link href={`/review/${attempt.id}`} className="rounded-xl bg-accent px-5 py-3 text-sm font-black text-white transition hover:bg-accent-strong">Xem lại bài</Link>
          </>
        )}
      </div>
    </article>
  );
}

function HistoryStat({ value, label }: { value: number | string; label: string }) {
  return <div className="min-w-20 rounded-xl border border-white/10 bg-white/10 px-3 py-3 text-center"><strong className="block text-xl font-black">{value}</strong><span className="mt-1 block text-[9px] font-bold uppercase tracking-wider text-blue-200">{label}</span></div>;
}

function StatusBadge({ status }: { status: AttemptHistoryItem["status"] }) {
  const style = status === "IN_PROGRESS" ? "bg-amber-100 text-amber-700" : status === "AUTO_SUBMITTED" ? "bg-blue-100 text-blue-700" : status === "SUBMITTED" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600";
  const label = status === "IN_PROGRESS" ? "Đang làm" : status === "AUTO_SUBMITTED" ? "Tự động nộp" : status === "SUBMITTED" ? "Hoàn thành" : status.replaceAll("_", " ");
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${style}`}>{label}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <span><span className="text-xs">{label}</span> <strong className="ml-1 text-foreground">{value}</strong></span>;
}

function HistorySkeleton() {
  return <div className="mt-6 space-y-4">{[0, 1, 2].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl border border-border bg-surface" />)}</div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatDuration(milliseconds: number) {
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  return `${minutes}p ${seconds}s`;
}

function BackIcon() {
  return <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
