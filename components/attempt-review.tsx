"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/auth-client";
import type {
  AttemptReview,
  ReviewAudioSegment,
  ReviewGroup,
  ReviewQuestion,
} from "@/lib/review-types";
import { ReviewStimuli } from "./review-stimuli";
import { SafeContentHtml } from "./safe-content-html";

type AnswerFilter = "ALL" | "CORRECT" | "WRONG" | "UNANSWERED";

export function AttemptReviewView({ attemptId }: { attemptId: string }) {
  const [review, setReview] = useState<AttemptReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answerFilter, setAnswerFilter] = useState<AnswerFilter>("ALL");
  const [partFilter, setPartFilter] = useState("ALL");
  const [topicFilter, setTopicFilter] = useState("ALL");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [creatingRetry, setCreatingRetry] = useState(false);

  useEffect(() => {
    apiFetch(`/attempts/${attemptId}/review`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseMessage(response));
        setReview((await response.json()) as AttemptReview);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Không tải được review"),
      )
      .finally(() => setLoading(false));
  }, [attemptId]);

  const questionRows = useMemo(
    () =>
      review?.sections.flatMap((section) =>
        section.groups.flatMap((group) =>
          group.questions.map((question) => ({ section, group, question })),
        ),
      ) ?? [],
    [review],
  );
  const parts = [...new Set(questionRows.map((row) => row.section.part).filter(Boolean))] as string[];
  const topics = [...new Set(questionRows.map((row) => row.question.grammarTopic).filter(Boolean))] as string[];
  const visibleIds = new Set(
    questionRows
      .filter(({ section, question }) => {
        const statusMatches =
          answerFilter === "ALL" ||
          (answerFilter === "CORRECT" && question.isCorrect) ||
          (answerFilter === "WRONG" && question.selectedOptionId !== null && !question.isCorrect) ||
          (answerFilter === "UNANSWERED" && question.selectedOptionId === null);
        return (
          statusMatches &&
          (partFilter === "ALL" || section.part === partFilter) &&
          (topicFilter === "ALL" || question.grammarTopic === topicFilter) &&
          (!flaggedOnly || question.isFlagged)
        );
      })
      .map((row) => row.question.id),
  );

  async function createRetry() {
    setCreatingRetry(true);
    setError(null);
    try {
      const response = await apiFetch(`/attempts/${attemptId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxQuestions: 100 }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const session = (await response.json()) as { id: string };
      window.location.href = `/practice/${session.id}`;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tạo được bài luyện lại");
      setCreatingRetry(false);
    }
  }

  if (loading) return <ReviewLoading />;
  if (!review) return <ReviewError detail={error} />;
  const result = review.attempt.result;
  const wrongCount = result?.wrongCount ?? questionRows.filter((row) => row.question.selectedOptionId && !row.question.isCorrect).length;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#031f48] text-white shadow-md">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center gap-3 px-4 sm:px-6">
          <Link href="/history" aria-label="Quay lại lịch sử" className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/20 transition hover:bg-white/10"><BackIcon /></Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-black sm:text-base">{review.test.title}</p>
            <p className="text-[10px] uppercase tracking-wider text-blue-200">Review · Version {review.test.version}</p>
          </div>
          <button onClick={createRetry} disabled={creatingRetry || wrongCount === 0} className="hidden rounded-xl bg-accent px-4 py-2 text-xs font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 sm:block">
            {creatingRetry ? "Đang tạo…" : `Luyện lại ${wrongCount} câu sai`}
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-6 px-4 py-6 lg:grid-cols-[270px_minmax(0,1fr)] lg:px-6">
        <aside className="lg:sticky lg:top-22 lg:self-start">
          <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-accent-strong">Tổng quan</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniStat label="Đúng" value={result?.correctCount ?? 0} tone="text-emerald-600" />
              <MiniStat label="Sai" value={wrongCount} tone="text-rose-600" />
              <MiniStat label="Trống" value={result?.unansweredCount ?? 0} tone="text-amber-600" />
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-muted">Lọc câu hỏi</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(["ALL", "CORRECT", "WRONG", "UNANSWERED"] as AnswerFilter[]).map((filter) => (
                <button key={filter} onClick={() => setAnswerFilter(filter)} className={`rounded-lg px-2 py-2 text-xs font-bold transition ${answerFilter === filter ? "bg-accent text-white" : "bg-surface-raised text-muted hover:text-foreground"}`}>{filterLabel(filter)}</button>
              ))}
            </div>
            <label className="mt-4 block text-xs font-bold text-muted">Part
              <select value={partFilter} onChange={(event) => setPartFilter(event.target.value)} className="mt-1.5 w-full rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-foreground">
                <option value="ALL">Tất cả Part</option>
                {parts.map((part) => <option key={part} value={part}>{partLabel(part)}</option>)}
              </select>
            </label>
            <label className="mt-3 block text-xs font-bold text-muted">Topic
              <select value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)} className="mt-1.5 w-full rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-foreground">
                <option value="ALL">Tất cả topic</option>
                {topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
              </select>
            </label>
            <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl bg-surface-raised px-3 py-2.5 text-xs font-bold">
              <input type="checkbox" checked={flaggedOnly} onChange={(event) => setFlaggedOnly(event.target.checked)} className="size-4 accent-[#1677c8]" /> Chỉ câu đã flag
            </label>
          </section>

          <nav className="mt-4 max-h-64 overflow-y-auto rounded-2xl border border-border bg-surface p-4 shadow-sm exam-scrollbar">
            <div className="grid grid-cols-5 gap-2">
              {questionRows.map(({ question }) => (
                <a key={question.id} href={`#review-${question.id}`} className={`grid aspect-square place-items-center rounded-lg text-xs font-black ${question.selectedOptionId === null ? "bg-slate-100 text-slate-500" : question.isCorrect ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"} ${visibleIds.has(question.id) ? "" : "opacity-25"}`}>{question.number}</a>
              ))}
            </div>
          </nav>

          <button onClick={createRetry} disabled={creatingRetry || wrongCount === 0} className="mt-4 w-full rounded-xl bg-accent px-4 py-3 text-sm font-black text-white sm:hidden disabled:opacity-45">Luyện lại câu sai</button>
        </aside>

        <div className="min-w-0 space-y-6">
          {error && <p className="rounded-xl bg-danger-soft p-4 text-sm font-semibold text-danger">{error}</p>}
          {review.sections.map((section) =>
            section.groups.map((group) => {
              const questions = group.questions.filter((question) => visibleIds.has(question.id));
              return questions.length ? <ReviewGroupCard key={group.id} group={group} questions={questions} part={section.part} kind={section.kind} /> : null;
            }),
          )}
          {visibleIds.size === 0 && <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center text-muted">Không có câu hỏi phù hợp bộ lọc.</div>}
        </div>
      </div>
    </main>
  );
}

function ReviewGroupCard({ group, questions, part, kind }: { group: ReviewGroup; questions: ReviewQuestion[]; part: string | null; kind: string }) {
  const hasStimuli = group.stimuli.length > 0;
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <header className="flex items-center justify-between border-b border-border bg-surface-raised px-5 py-3">
        <div><span className="text-xs font-black uppercase tracking-wider text-accent-strong">{part ? partLabel(part) : kind}</span>{group.title && <h2 className="mt-1 font-bold">{group.title}</h2>}</div>
        <span className="text-xs text-muted">Câu {questions.map((question) => question.number).join(", ")}</span>
      </header>
      <div className={hasStimuli ? "grid xl:grid-cols-2" : ""}>
        {hasStimuli && <div className="border-b border-border p-5 xl:border-b-0 xl:border-r"><ReviewStimuli stimuli={group.stimuli} /></div>}
        <div className="divide-y divide-border">
          {questions.map((question) => <ReviewQuestionCard key={question.id} question={question} />)}
        </div>
      </div>
      {group.transcriptHtml && (
        <details className="border-t border-border bg-blue-50/40 dark:bg-blue-950/20">
          <summary className="cursor-pointer px-5 py-4 text-sm font-black text-accent-strong">Xem transcript</summary>
          <div className="border-t border-blue-100 bg-white p-5"><SafeContentHtml html={group.transcriptHtml} /></div>
        </details>
      )}
    </section>
  );
}

function ReviewQuestionCard({ question }: { question: ReviewQuestion }) {
  const status = question.selectedOptionId === null ? "UNANSWERED" : question.isCorrect ? "CORRECT" : "WRONG";
  return (
    <article id={`review-${question.id}`} className="scroll-mt-24 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-sm font-black ${status === "CORRECT" ? "bg-emerald-100 text-emerald-700" : status === "WRONG" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>{question.number}</span>
        <div className="min-w-0 flex-1"><SafeContentHtml html={question.promptHtml} compact /></div>
        {question.isFlagged && <span title="Đã flag" className="text-xl text-amber-500">⚑</span>}
      </div>

      <div className="mt-4 space-y-2">
        {question.options.map((option) => {
          const correct = option.id === question.correctOptionId;
          const selected = option.id === question.selectedOptionId;
          const style = correct ? "border-emerald-400 bg-emerald-50 text-emerald-900" : selected ? "border-rose-400 bg-rose-50 text-rose-900" : "border-border bg-surface-raised";
          return <div key={option.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${style}`}><strong className="shrink-0">({option.label})</strong><div className="min-w-0 flex-1"><SafeContentHtml html={option.contentHtml} compact /></div>{correct && <span className="shrink-0 text-xs font-black text-emerald-700">Đáp án đúng</span>}{selected && !correct && <span className="shrink-0 text-xs font-black text-rose-700">Bạn chọn</span>}</div>;
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-muted">
        <span className="rounded-full bg-surface-raised px-2.5 py-1">{formatTime(question.activeTimeMs)}</span>
        <span className="rounded-full bg-surface-raised px-2.5 py-1">{question.visitCount} lần xem</span>
        {question.difficulty && <span className="rounded-full bg-surface-raised px-2.5 py-1">{question.difficulty}</span>}
        {question.grammarTopic && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">{question.grammarTopic}</span>}
        {question.vocabularyTags.map((tag) => <span key={tag} className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-700">{tag}</span>)}
      </div>

      {question.audioSegments.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{question.audioSegments.map((segment) => <SegmentPlayer key={segment.id} segment={segment} />)}</div>}

      <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/20">
        <p className="text-xs font-black uppercase tracking-wider text-accent-strong">Giải thích</p>
        <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
          {question.explanationHtml ? <SafeContentHtml html={question.explanationHtml} compact /> : "Câu này chưa có lời giải chi tiết."}
        </div>
      </div>
    </article>
  );
}

function SegmentPlayer({ segment }: { segment: ReviewAudioSegment }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  if (!segment.audio) return null;
  async function play() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = segment.startMs / 1000;
    await audio.play();
    setPlaying(true);
  }
  return (
    <div className="inline-flex items-center overflow-hidden rounded-xl border border-border bg-surface-raised">
      <audio ref={audioRef} src={segment.audio.url} preload="metadata" onPause={() => setPlaying(false)} onTimeUpdate={(event) => { const audio = event.currentTarget; if (audio.currentTime * 1000 >= segment.endMs) { if (loop) { audio.currentTime = segment.startMs / 1000; void audio.play(); } else { audio.pause(); audio.currentTime = segment.startMs / 1000; } } }} />
      <button onClick={() => void play()} className="px-3 py-2 text-xs font-black text-accent-strong">{playing ? "Đang nghe…" : segment.segmentType === "ANSWER_EVIDENCE" ? "▶ Nghe đoạn chứa đáp án" : "▶ Nghe ngữ cảnh"}</button>
      <button onClick={() => setLoop((current) => !current)} title="Lặp đoạn" className={`border-l border-border px-2.5 py-2 text-xs font-black ${loop ? "bg-accent text-white" : "text-muted"}`}>↻</button>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) { return <div className="rounded-xl bg-surface-raised p-2 text-center"><strong className={`block text-xl ${tone}`}>{value}</strong><span className="text-[9px] font-bold uppercase text-muted">{label}</span></div>; }
function filterLabel(filter: AnswerFilter) { return filter === "ALL" ? "Tất cả" : filter === "CORRECT" ? "Đúng" : filter === "WRONG" ? "Sai" : "Bỏ trống"; }
function partLabel(part: string) { return `Part ${part.replace("PART_", "")}`; }
function formatTime(ms: number) { return ms < 60_000 ? `${Math.round(ms / 1000)} giây` : `${Math.floor(ms / 60_000)}p ${Math.round((ms % 60_000) / 1000)}s`; }
function BackIcon() { return <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function ReviewLoading() { return <main className="grid min-h-screen place-items-center bg-background"><div className="text-center"><span className="mx-auto block size-10 animate-spin rounded-full border-4 border-accent-soft border-t-accent" /><p className="mt-4 text-sm font-bold text-muted">Đang chuẩn bị dữ liệu review…</p></div></main>; }
function ReviewError({ detail }: { detail: string | null }) { return <main className="grid min-h-screen place-items-center bg-background p-5"><div className="max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-lg"><h1 className="text-xl font-black">Không mở được bài review</h1><p className="mt-3 text-sm text-danger">{detail}</p><Link href="/history" className="mt-6 inline-flex rounded-xl bg-accent px-5 py-3 text-sm font-black text-white">Về lịch sử</Link></div></main>; }
async function responseMessage(response: Response) { const data = (await response.json().catch(() => null)) as { message?: string } | null; return data?.message ?? `Request failed (${response.status})`; }
