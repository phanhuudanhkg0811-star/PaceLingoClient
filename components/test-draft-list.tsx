"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/auth-client";
import { ThemeToggle } from "./theme-toggle";

interface TestSummary {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  totalQuestions: number;
  durationMinutes: number;
  updatedAt: string;
  currentPublishedVersion: { version: number } | null;
  _count: { sections: number; versions: number; attempts: number };
}

export function TestDraftList() {
  const [items, setItems] = useState<TestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch("/admin/tests");
      if (!response.ok) throw new Error(await message(response));
      setItems((await response.json()) as TestSummary[]);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể tải danh sách đề",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  async function archive(test: TestSummary) {
    if (
      !window.confirm(
        `Gỡ “${test.title}” khỏi danh sách đề công khai? Lịch sử làm bài vẫn được giữ lại.`,
      )
    )
      return;
    setBusyId(test.id);
    setError(null);
    try {
      const response = await apiFetch(`/admin/tests/${test.id}/archive`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(await message(response));
      setItems((current) =>
        current.map((item) =>
          item.id === test.id
            ? { ...item, status: "ARCHIVED", currentPublishedVersion: null }
            : item,
        ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể gỡ công khai đề",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function remove(test: TestSummary) {
    const publishedWarning =
      test.status === "DRAFT"
        ? ""
        : " Đề chỉ xóa được khi chưa có lượt thi; nếu đã có lượt thi, hãy dùng Gỡ công khai.";
    if (!window.confirm(`Xóa vĩnh viễn “${test.title}”?${publishedWarning}`))
      return;
    setBusyId(test.id);
    setError(null);
    try {
      const response = await apiFetch(`/admin/tests/${test.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await message(response));
      setItems((current) => current.filter((item) => item.id !== test.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xóa đề");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="min-h-screen px-4 py-7 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <Link href="/admin" className="text-sm font-semibold text-accent">
              ← Trung tâm quản trị
            </Link>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-accent">
              Test authoring
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-5xl">Test Drafts</h1>
            <p className="mt-3 text-muted">
              Mở đề đã import để hoàn thiện nội dung, media, timeline và
              publish.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin/imports"
              className="rounded-xl border border-border bg-surface px-4 py-3 text-sm font-bold hover:border-accent"
            >
              + Import JSON
            </Link>
            <ThemeToggle />
          </div>
        </header>
        {error && (
          <p className="mt-6 rounded-2xl bg-danger-soft p-4 text-danger">
            {error}
          </p>
        )}
        {loading ? (
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-64 animate-pulse rounded-3xl bg-surface"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-border bg-surface/60 p-16 text-center text-muted">
            Chưa có Test Draft. Hãy import JSON trước.
          </div>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {items.map((test) => (
              <article
                key={test.id}
                className="group overflow-hidden rounded-3xl border border-border bg-surface shadow-[0_16px_45px_rgba(var(--shadow),0.07)] transition hover:-translate-y-1 hover:border-accent/50"
              >
                <Link href={`/admin/tests/${test.id}`} className="block p-6 pb-4">
                  <div className="flex items-center justify-between">
                    <Status status={test.status} />
                    <span className="text-xs text-muted">
                      {test.type.replaceAll("_", " ")}
                    </span>
                  </div>
                  <h2 className="mt-5 text-xl font-bold group-hover:text-accent">
                    {test.title}
                  </h2>
                  <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-muted">
                    {test.description ?? "Chưa có mô tả"}
                  </p>
                  <div className="mt-6 grid grid-cols-3 gap-2 text-center">
                    <Metric value={test.totalQuestions} label="Câu" />
                    <Metric value={test._count.sections} label="Part" />
                    <Metric value={test.durationMinutes} label="Phút" />
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs text-muted">
                    <span>
                      {test._count.versions
                        ? `${test._count.versions} snapshot`
                        : "Chưa publish"}
                    </span>
                    <span>
                      {new Date(test.updatedAt).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                </Link>
                <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-raised/55 px-6 py-3">
                  {test.status === "PUBLISHED" && (
                    <button
                      type="button"
                      disabled={busyId === test.id}
                      onClick={() => void archive(test)}
                      className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-muted transition hover:border-accent hover:text-accent disabled:cursor-wait disabled:opacity-50"
                    >
                      Gỡ công khai
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyId === test.id || test._count.attempts > 0}
                    title={
                      test._count.attempts > 0
                        ? "Đề đã có lượt thi nên chỉ có thể gỡ công khai"
                        : "Xóa vĩnh viễn đề"
                    }
                    onClick={() => void remove(test)}
                    className="rounded-lg px-3 py-2 text-xs font-bold text-danger transition hover:bg-danger-soft disabled:cursor-wait disabled:opacity-50"
                  >
                    {busyId === test.id ? "Đang xử lý…" : "Xóa"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Status({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
        status === "DRAFT"
          ? "bg-amber-400/15 text-amber-600 dark:text-amber-300"
          : status === "ARCHIVED"
            ? "bg-surface-raised text-muted"
            : "bg-accent-soft text-accent-strong"
      }`}
    >
      {status}
    </span>
  );
}
function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-surface-raised p-3">
      <strong className="block text-lg">{value}</strong>
      <span className="text-[10px] uppercase tracking-wide text-muted">
        {label}
      </span>
    </div>
  );
}
async function message(response: Response) {
  const body = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  return Array.isArray(body?.message)
    ? body.message.join(", ")
    : (body?.message ?? `Request failed (${response.status})`);
}
