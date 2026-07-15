"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/auth-client";

interface FeedbackItem {
  id: string;
  type: "CONTACT" | "QUESTION_ERROR";
  status: "OPEN" | "RESOLVED" | "DISMISSED";
  name: string | null;
  email: string | null;
  subject: string;
  message: string;
  contextJson: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null } | null;
}

export function FeedbackInbox() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await apiFetch("/feedback");
        if (!response.ok) throw new Error(`Không tải được phản hồi (${response.status})`);
        if (active) setItems((await response.json()) as FeedbackItem[]);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Không tải được phản hồi");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);
  async function updateStatus(id: string, status: FeedbackItem["status"]) {
    const response = await apiFetch(`/feedback/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  }

  return <main className="min-h-screen bg-background px-5 py-8 text-foreground sm:px-8">
    <div className="mx-auto max-w-6xl">
      <header className="flex items-center gap-4"><Link href="/admin" className="grid size-10 place-items-center rounded-xl border border-border bg-surface">←</Link><div><p className="text-xs font-black uppercase tracking-wider text-accent-strong">Admin inbox</p><h1 className="mt-1 text-3xl font-black">Phản hồi & báo lỗi</h1></div></header>
      {loading && <p className="mt-8 text-muted">Đang tải…</p>}{error && <p className="mt-8 rounded-xl bg-danger-soft p-4 text-danger">{error}</p>}
      <div className="mt-8 space-y-4">{items.map((item) => <article key={item.id} className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="rounded-full bg-accent-soft px-2.5 py-1 text-[10px] font-black text-accent-strong">{item.type === "CONTACT" ? "LIÊN HỆ" : "LỖI CÂU HỎI"}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${item.status === "OPEN" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{item.status}</span></div><time className="text-xs text-muted">{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</time></div>
        <h2 className="mt-4 text-lg font-black">{item.subject}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{item.message}</p>
        <p className="mt-3 text-xs text-muted">Từ: {item.name ?? item.user?.name ?? "Người dùng"} · {item.email ?? item.user?.email ?? "Không có email"}</p>
        {item.contextJson && <pre className="mt-3 overflow-auto rounded-lg bg-surface-raised p-3 text-[11px] text-muted">{JSON.stringify(item.contextJson, null, 2)}</pre>}
        <div className="mt-4 flex gap-2"><button onClick={() => void updateStatus(item.id, "RESOLVED")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white">Đã xử lý</button><button onClick={() => void updateStatus(item.id, "DISMISSED")} className="rounded-lg border border-border px-3 py-2 text-xs font-bold">Bỏ qua</button></div>
      </article>)}</div>
      {!loading && !error && items.length === 0 && <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface p-12 text-center text-muted">Chưa có phản hồi nào.</div>}
    </div>
  </main>;
}
