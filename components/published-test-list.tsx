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

  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-accent">
              Candidate tests
            </p>
            <h1 className="mt-2 text-3xl font-bold">Chọn đề thi</h1>
            <p className="mt-2 text-sm text-muted">
              Chỉ các version đã publish mới xuất hiện tại đây.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/" className="rounded-xl border border-border bg-surface px-4 py-2 text-sm">
              Trang chủ
            </Link>
            <ThemeToggle />
          </div>
        </header>

        {loading && <p className="mt-10 text-muted">Đang tải danh sách đề…</p>}
        {error && <p className="mt-10 rounded-xl bg-danger-soft p-4 text-danger">{error}</p>}
        {!loading && !error && tests.length === 0 && (
          <div className="mt-10 rounded-3xl border border-dashed border-border bg-surface p-12 text-center text-muted">
            Chưa có đề nào được publish.
          </div>
        )}
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {tests.map((test) => (
            <article key={test.id} className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-accent">
                    {test.type.replaceAll("_", " ")} · Version {test.currentPublishedVersion?.version}
                  </p>
                  <h2 className="mt-2 text-xl font-bold">{test.title}</h2>
                </div>
                <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent-strong">
                  Published
                </span>
              </div>
              <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-muted">
                {test.description ?? "Đề thi TOEIC Listening & Reading"}
              </p>
              <div className="mt-5 flex gap-4 text-xs font-bold text-muted">
                <span>{test.totalQuestions} câu</span>
                <span>{test.durationMinutes} phút</span>
              </div>
              <Link
                href={`/exam/${test.id}`}
                className="mt-6 block rounded-xl bg-[#07579a] px-4 py-3 text-center text-sm font-bold text-white"
              >
                Mở phòng thi →
              </Link>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
