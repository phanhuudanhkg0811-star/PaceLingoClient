"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/auth-client";
import type { PracticeSession } from "@/lib/review-types";
import { ReviewStimuli } from "./review-stimuli";
import { SafeContentHtml } from "./safe-content-html";

export function RetryPractice({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`/practice-sessions/${sessionId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseMessage(response));
        const payload = (await response.json()) as PracticeSession;
        setSession(payload);
        setAnswers(Object.fromEntries(payload.questions.filter((question) => question.selectedOptionId).map((question) => [question.id, question.selectedOptionId!])))
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Không tải được bài luyện"))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const completed = session?.status === "COMPLETED";
  const correctCount = useMemo(
    () => session?.questions.filter((question) => question.isCorrect).length ?? 0,
    [session],
  );

  async function submit() {
    if (!session || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await apiFetch(`/practice-sessions/${session.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: session.questions.map((question) => ({
            questionId: question.id,
            optionId: answers[question.id] ?? null,
          })),
        }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      setSession((await response.json()) as PracticeSession);
      setIndex(0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không nộp được bài luyện");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PracticeState title="Đang tạo bài luyện lại…" />;
  if (!session || !session.questions.length) return <PracticeState title="Không mở được bài luyện" detail={error} />;
  const question = session.questions[index];
  const selected = answers[question.id] ?? null;

  return (
    <main className="flex min-h-screen flex-col bg-[#edf3fa] text-slate-800">
      <header className="grid min-h-16 grid-cols-[48px_1fr_auto] items-center gap-3 bg-[#031f48] px-4 text-white shadow-md">
        <Link href={session.sourceAttemptId ? `/review/${session.sourceAttemptId}` : "/history"} aria-label="Quay lại" className="grid size-9 place-items-center rounded-xl border border-white/20 hover:bg-white/10"><BackIcon /></Link>
        <div className="min-w-0 text-center"><h1 className="truncate text-sm font-black sm:text-base">Luyện lại câu sai</h1><p className="text-[10px] uppercase tracking-wider text-blue-200">{session.test?.title ?? "Retry quiz"}</p></div>
        <span className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black">{index + 1}/{session.questions.length}</span>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6">
        {completed && (
          <section className="mb-5 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:flex sm:items-center sm:justify-between">
            <div><p className="text-xs font-black uppercase tracking-wider text-emerald-600">Đã hoàn thành</p><h2 className="mt-1 text-2xl font-black text-[#082c59]">Bạn làm đúng {correctCount}/{session.questions.length} câu</h2></div>
            <Link href={session.sourceAttemptId ? `/review/${session.sourceAttemptId}` : "/history"} className="mt-3 inline-flex rounded-xl bg-[#07579a] px-4 py-2.5 text-sm font-black text-white sm:mt-0">Quay lại review</Link>
          </section>
        )}

        {error && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}

        <section className={`grid flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${question.group.stimuli.length > 0 ? "lg:grid-cols-2" : ""}`}>
          {question.group.stimuli.length > 0 && <div className="border-b border-slate-200 p-5 lg:border-b-0 lg:border-r"><p className="mb-3 text-xs font-black uppercase tracking-wider text-[#075fa8]">{question.group.section.part?.replace("PART_", "Part ") ?? "Passage"}</p><ReviewStimuli stimuli={question.group.stimuli} /></div>}
          <div className="p-5 sm:p-7">
            <div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-100 font-black text-[#075fa8]">{question.number}</span><div className="min-w-0 flex-1"><SafeContentHtml html={question.promptHtml} compact /></div></div>
            <div className="mt-5 space-y-2.5">
              {question.options.map((option) => {
                const isSelected = selected === option.id;
                const isCorrect = completed && option.id === question.correctOptionId;
                const isWrongSelection = completed && isSelected && !isCorrect;
                return (
                  <button key={option.id} disabled={completed} onClick={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))} className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${isCorrect ? "border-emerald-400 bg-emerald-50" : isWrongSelection ? "border-rose-400 bg-rose-50" : isSelected ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/40"}`}>
                    <span className={`grid size-7 shrink-0 place-items-center rounded-full border text-xs font-black ${isSelected ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300"}`}>{option.label}</span>
                    <span className="min-w-0 flex-1"><SafeContentHtml html={option.contentHtml} compact /></span>
                  </button>
                );
              })}
            </div>

            {completed && <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4"><p className="text-xs font-black uppercase tracking-wider text-[#075fa8]">Giải thích</p><div className="mt-2 text-sm">{question.explanationHtml ? <SafeContentHtml html={question.explanationHtml} compact /> : "Câu này chưa có lời giải chi tiết."}</div></div>}
          </div>
        </section>

        <footer className="mt-5 flex items-center justify-between gap-3">
          <button disabled={index === 0} onClick={() => setIndex((current) => Math.max(0, current - 1))} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black disabled:opacity-35">← Trước</button>
          <div className="hidden flex-wrap justify-center gap-1.5 sm:flex">{session.questions.map((item, itemIndex) => <button key={item.id} onClick={() => setIndex(itemIndex)} className={`grid size-8 place-items-center rounded-lg text-xs font-black ${itemIndex === index ? "bg-[#07579a] text-white" : answers[item.id] ? "bg-blue-100 text-blue-700" : "bg-white text-slate-500"}`}>{itemIndex + 1}</button>)}</div>
          {index < session.questions.length - 1 ? <button onClick={() => setIndex((current) => Math.min(session.questions.length - 1, current + 1))} className="rounded-xl bg-[#07579a] px-5 py-3 text-sm font-black text-white">Tiếp →</button> : !completed ? <button onClick={() => void submit()} disabled={submitting} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50">{submitting ? "Đang nộp…" : "Nộp bài luyện"}</button> : <span />}
        </footer>
      </div>
    </main>
  );
}

function PracticeState({ title, detail }: { title: string; detail?: string | null }) { return <main className="grid min-h-screen place-items-center bg-background p-5"><div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-lg"><h1 className="text-xl font-black">{title}</h1>{detail && <p className="mt-3 text-sm text-danger">{detail}</p>}<Link href="/history" className="mt-5 inline-flex text-sm font-bold text-accent-strong">← Về lịch sử</Link></div></main>; }
function BackIcon() { return <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
async function responseMessage(response: Response) { const payload = (await response.json().catch(() => null)) as { message?: string } | null; return payload?.message ?? `Request failed (${response.status})`; }
