"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/auth-client";
import { ThemeToggle } from "./theme-toggle";

interface PublishedTest {
  id: string;
  title: string;
  description: string | null;
  type: string;
  totalQuestions: number;
  durationMinutes: number;
  publishedAt: string | null;
  currentPublishedVersion: {
    id: string;
    version: number;
    schemaVersion: number;
  } | null;
}

export function PublishedTestList() {
  const [tests, setTests] = useState<PublishedTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/tests")
      .then(async (response) => {
        if (!response.ok) throw new Error(`Không tải được đề (${response.status})`);
        setTests((await response.json()) as PublishedTest[]);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Không tải được đề"),
      )
      .finally(() => setLoading(false));
  }, []);

  const totalQuestions = tests.reduce(
    (sum, test) => sum + test.totalQuestions,
    0,
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 pb-16 pt-5 text-foreground sm:px-7 sm:pt-7">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_18%_10%,rgba(56,163,255,0.16),transparent_28rem),radial-gradient(circle_at_90%_0%,rgba(22,119,200,0.12),transparent_24rem)]" />

      <div className="relative mx-auto max-w-7xl">
        <nav className="flex items-center justify-between">
          <Link
            href="/"
            aria-label="Quay lại"
            title="Quay lại"
            className="group grid size-11 place-items-center rounded-2xl border border-border bg-surface text-foreground shadow-sm transition duration-200 hover:-translate-x-0.5 hover:border-accent/40 hover:text-accent-strong hover:shadow-md"
          >
            <BackIcon />
          </Link>
          <ThemeToggle />
        </nav>

        <section className="relative mt-6 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#061d42] via-[#07386d] to-[#0868ae] px-6 py-9 text-white shadow-[0_28px_90px_rgba(3,31,72,0.22)] sm:px-10 sm:py-12 lg:px-14">
          <div aria-hidden="true" className="absolute -right-20 -top-24 size-80 rounded-full border-[46px] border-white/5" />
          <div aria-hidden="true" className="absolute -bottom-36 right-[28%] size-72 rounded-full bg-sky-300/10 blur-3xl" />

          <div className="relative grid items-end gap-9 lg:grid-cols-[1fr_auto]">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/25 bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-sky-200 backdrop-blur">
                <span className="size-1.5 rounded-full bg-sky-300 shadow-[0_0_12px_#7dd3fc]" />
                Exam library
              </span>
              <h1 className="mt-5 text-3xl font-black leading-tight tracking-[-0.03em] sm:text-5xl lg:text-6xl">
                Chọn một đề,
                <span className="block text-sky-300">vào nhịp thi thật.</span>
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-blue-100/85 sm:text-base">
                Làm bài trong giao diện mô phỏng phòng thi, tự lưu tiến độ và nhận
                kết quả chi tiết ngay sau khi hoàn thành.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <HeroStat value={loading ? "—" : tests.length} label="Đề thi" />
              <HeroStat value={loading ? "—" : totalQuestions} label="Câu hỏi" />
              <HeroStat value="7" label="TOEIC Parts" />
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-accent-strong">Đề đang mở</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Sẵn sàng để bắt đầu</h2>
            </div>
            {!loading && !error && tests.length > 0 && (
              <p className="text-sm text-muted">{tests.length} đề đã được phát hành</p>
            )}
          </div>

          {loading && <TestListSkeleton />}

          {error && (
            <div className="mt-7 flex items-start gap-3 rounded-2xl border border-danger/20 bg-danger-soft p-5 text-danger">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-danger/10 font-black">!</span>
              <div>
                <p className="font-bold">Không thể tải danh sách đề</p>
                <p className="mt-1 text-sm opacity-80">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && tests.length === 0 && (
            <div className="mt-7 rounded-[2rem] border border-dashed border-border bg-surface px-6 py-16 text-center shadow-sm">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent-strong">
                <DocumentIcon />
              </span>
              <h3 className="mt-5 text-lg font-black">Chưa có đề thi nào</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                Đề đã publish sẽ tự động xuất hiện tại đây.
              </p>
            </div>
          )}

          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            {tests.map((test, index) => (
              <TestCard key={test.id} test={test} index={index} />
            ))}
          </div>
        </section>

        <footer className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-border pt-7 text-xs text-muted">
          <span className="inline-flex items-center gap-2"><ShieldIcon /> Không hiển thị đáp án khi đang thi</span>
          <span className="inline-flex items-center gap-2"><CloudIcon /> Tự động lưu tiến độ</span>
          <span className="inline-flex items-center gap-2"><ChartIcon /> Kết quả theo từng Part</span>
        </footer>
      </div>
    </main>
  );
}

function TestCard({ test, index }: { test: PublishedTest; index: number }) {
  const type = testType(test.type);
  return (
    <article className="group relative overflow-hidden rounded-[1.65rem] border border-border bg-surface shadow-[0_12px_40px_rgba(var(--shadow),0.07)] transition duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-[0_22px_60px_rgba(var(--shadow),0.13)]">
      <div className={`h-1.5 w-full ${index % 2 === 0 ? "bg-gradient-to-r from-[#0b4f8a] via-[#1677c8] to-[#56b4f2]" : "bg-gradient-to-r from-[#192f66] via-[#526dcc] to-[#55a7e8]"}`} />
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-accent-strong">{type.label}</span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Đang mở
              </span>
            </div>
            <h3 className="mt-4 line-clamp-2 text-xl font-black leading-snug tracking-tight text-foreground sm:text-2xl">{test.title}</h3>
          </div>
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent-soft to-surface-raised text-accent-strong transition duration-300 group-hover:scale-105 group-hover:bg-accent group-hover:text-white">
            <DocumentIcon />
          </span>
        </div>

        <p className="mt-3 line-clamp-2 min-h-12 text-sm leading-6 text-muted">
          {test.description ?? type.description}
        </p>

        <div className="mt-5 grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-surface-raised px-2 py-3">
          <TestMetric icon={<QuestionIcon />} value={`${test.totalQuestions}`} label="câu hỏi" />
          <TestMetric icon={<ClockIcon />} value={`${test.durationMinutes}`} label="phút" />
          <TestMetric icon={<VersionIcon />} value={`v${test.currentPublishedVersion?.version ?? 1}`} label="phiên bản" />
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted">
            <p className="font-bold text-foreground">Listening & Reading</p>
            <p className="mt-1">Phát hành {formatPublishedDate(test.publishedAt)}</p>
          </div>
          <Link
            href={`/exam/${test.id}`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#07579a] to-[#1677c8] px-5 py-3 text-sm font-black text-white shadow-md shadow-blue-900/10 transition duration-200 hover:gap-3 hover:brightness-110"
          >
            Vào phòng thi <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </article>
  );
}

function HeroStat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="min-w-20 rounded-2xl border border-white/10 bg-white/10 px-3 py-3 text-center backdrop-blur sm:min-w-24 sm:px-4">
      <p className="text-xl font-black text-white sm:text-2xl">{value}</p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-blue-200 sm:text-[10px]">{label}</p>
    </div>
  );
}

function TestMetric({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-2">
      <span className="hidden text-accent-strong sm:block">{icon}</span>
      <span>
        <strong className="block text-sm font-black text-foreground">{value}</strong>
        <span className="block text-[10px] text-muted">{label}</span>
      </span>
    </div>
  );
}

function TestListSkeleton() {
  return (
    <div className="mt-7 grid gap-5 lg:grid-cols-2" aria-label="Đang tải đề thi">
      {[0, 1].map((item) => (
        <div key={item} className="animate-pulse rounded-[1.65rem] border border-border bg-surface p-6">
          <div className="h-5 w-24 rounded-full bg-accent-soft" />
          <div className="mt-5 h-7 w-2/3 rounded-lg bg-accent-soft" />
          <div className="mt-4 h-4 w-full rounded bg-accent-soft/70" />
          <div className="mt-2 h-4 w-4/5 rounded bg-accent-soft/70" />
          <div className="mt-6 h-16 rounded-2xl bg-surface-raised" />
        </div>
      ))}
    </div>
  );
}

function testType(type: string) {
  if (type === "MINI_TEST") {
    return { label: "Mini test", description: "Bài thi ngắn giúp bạn luyện tập tập trung theo mục tiêu." };
  }
  if (type === "PART_PRACTICE") {
    return { label: "Part practice", description: "Bài luyện tập chuyên biệt cho một hoặc nhiều Part TOEIC." };
  }
  return { label: "Full test", description: "Đề thi TOEIC Listening & Reading với trải nghiệm mô phỏng thi thật." };
}

function formatPublishedDate(value: string | null) {
  if (!value) return "gần đây";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function BackIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function DocumentIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" strokeLinejoin="round" /><path d="M14 3v5h5M9 13h6M9 17h4" strokeLinecap="round" /></svg>;
}

function QuestionIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.3 2.3 0 1 1 3.4 2c-.8.5-1.2.9-1.2 2M12 16.5h.01" strokeLinecap="round" /></svg>;
}

function ClockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function VersionIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 6h12v12H6z" /><path d="M9 3h12v12M3 9v12h12" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ShieldIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 text-accent-strong" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3 5 6v5c0 4.5 2.8 8.1 7 10 4.2-1.9 7-5.5 7-10V6l-7-3Z" strokeLinejoin="round" /><path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CloudIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 text-accent-strong" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 18h10a4 4 0 0 0 .7-7.9A6 6 0 0 0 6.2 9 4.5 4.5 0 0 0 7 18Z" strokeLinejoin="round" /><path d="m9 13 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ChartIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 text-accent-strong" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 20V10m7 10V4m7 16v-7" strokeLinecap="round" /><path d="M3 20h18" strokeLinecap="round" /></svg>;
}
