"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/auth-client";
import { loadCandidateSnapshot } from "@/lib/candidate-loader";
import type {
  CandidateGroup,
  CandidateManifest,
  CandidatePayload,
  CandidateQuestion,
  CandidateRuntime,
  CandidateSection,
  CandidateStimulus,
} from "@/lib/candidate-types";
import { deriveTimelineState, listeningDurationMs } from "@/lib/timeline-runtime";

type Stage = "loading" | "ready" | "listening" | "reading" | "error";

export function CandidateExam({ testId }: { testId: string }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [manifest, setManifest] = useState<CandidateManifest | null>(null);
  const [payload, setPayload] = useState<CandidatePayload | null>(null);
  const [runtime, setRuntime] = useState<CandidateRuntime | null>(null);
  const [positionMs, setPositionMs] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [cacheSource, setCacheSource] = useState<"network" | "cache" | null>(null);
  const [audioStatus, setAudioStatus] = useState("Sẵn sàng");
  const audioRef = useRef<HTMLAudioElement>(null);
  const highestPositionRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await apiFetch(`/tests/${testId}/runtime`);
        if (!response.ok) throw new Error(await responseMessage(response));
        const nextManifest = (await response.json()) as CandidateManifest;
        if (nextManifest.testVersion.schemaVersion !== 1) {
          throw new Error("Version của đề chưa được client hỗ trợ");
        }
        const snapshot = await loadCandidateSnapshot(nextManifest);
        if (cancelled) return;
        setManifest(nextManifest);
        setPayload(snapshot.payload);
        setCacheSource(snapshot.source);
        setStage("ready");
      } catch (reason) {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "Không tải được đề");
        setStage("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [testId]);

  const runtimeKey = manifest
    ? `pace-lingo:runtime:${manifest.testVersion.id}`
    : null;

  const startOrResume = useCallback(async () => {
    if (!payload || !runtimeKey) return;
    setError(null);
    try {
      const savedToken = localStorage.getItem(runtimeKey);
      const response = await apiFetch(`/tests/${testId}/runtime`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(savedToken ? { runtimeToken: savedToken } : {}),
      });
      if (!response.ok) {
        if (savedToken && response.status === 401) localStorage.removeItem(runtimeKey);
        throw new Error(await responseMessage(response));
      }
      const nextRuntime = (await response.json()) as CandidateRuntime;
      localStorage.setItem(runtimeKey, nextRuntime.runtimeToken);
      setRuntime(nextRuntime);

      const listeningEnd = listeningDurationMs(payload);
      if (!payload.test.fullListeningAudio || listeningEnd === 0) {
        setStage("reading");
        return;
      }
      if (nextRuntime.expectedAudioPositionMs >= listeningEnd) {
        setPositionMs(listeningEnd);
        setStage("reading");
        return;
      }

      const audio = audioRef.current;
      if (!audio) throw new Error("Audio player chưa sẵn sàng");
      const expectedSeconds = nextRuntime.expectedAudioPositionMs / 1000;
      await ensureMediaReady(audio);
      audio.currentTime = expectedSeconds;
      highestPositionRef.current = expectedSeconds;
      setPositionMs(nextRuntime.expectedAudioPositionMs);
      setStage("listening");
      setAudioStatus("Đang phát");
      await audio.play();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể bắt đầu bài thi");
      setStage("ready");
    }
  }, [payload, runtimeKey, testId]);

  useEffect(() => {
    if (stage !== "listening" || !payload) return;
    const audio = audioRef.current;
    if (!audio) return;
    let frame = 0;
    const sync = () => {
      const nextPosition = Math.max(0, audio.currentTime * 1000);
      highestPositionRef.current = Math.max(
        highestPositionRef.current,
        audio.currentTime,
      );
      setPositionMs(nextPosition);
      if (deriveTimelineState(payload, nextPosition).listeningEnded) {
        audio.pause();
        setStage("reading");
        return;
      }
      if (!audio.paused && document.visibilityState === "visible") {
        frame = requestAnimationFrame(sync);
      }
    };
    const onPlaying = () => {
      setAudioStatus("Đang phát");
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };
    const onWaiting = () => setAudioStatus("Đang tải audio…");
    const onTimeUpdate = () => sync();
    const onVisibility = () => sync();
    const onSeeking = () => {
      if (audio.currentTime + 0.75 < highestPositionRef.current) {
        audio.currentTime = highestPositionRef.current;
      }
    };
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("seeking", onSeeking);
    document.addEventListener("visibilitychange", onVisibility);
    frame = requestAnimationFrame(sync);
    return () => {
      cancelAnimationFrame(frame);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("seeking", onSeeking);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [payload, stage]);

  if (stage === "loading") return <ExamMessage title="Đang tải đề thi…" />;
  if (stage === "error" || !payload || !manifest) {
    return <ExamMessage title="Không thể mở đề" detail={error ?? undefined} />;
  }

  return (
    <main className="min-h-screen bg-[#e9eaec] text-slate-900">
      {payload.test.fullListeningAudio && (
        <audio
          ref={audioRef}
          src={payload.test.fullListeningAudio.url}
          preload="auto"
          onEnded={() => setStage("reading")}
          className="hidden"
        />
      )}

      {stage === "ready" && (
        <StartScreen
          payload={payload}
          cached={cacheSource === "cache"}
          hasSavedRuntime={Boolean(runtimeKey && localStorageSafe(runtimeKey))}
          error={error}
          onStart={() => void startOrResume()}
        />
      )}
      {stage === "listening" && (
        <ListeningPlayer
          payload={payload}
          positionMs={positionMs}
          audioStatus={audioStatus}
          answers={answers}
          setAnswer={(questionId, optionId) =>
            setAnswers((current) => ({ ...current, [questionId]: optionId }))
          }
        />
      )}
      {stage === "reading" && (
        <ReadingPlayer
          payload={payload}
          answers={answers}
          setAnswer={(questionId, optionId) =>
            setAnswers((current) => ({ ...current, [questionId]: optionId }))
          }
        />
      )}
      {runtime && (
        <span className="fixed bottom-1 left-1 text-[8px] text-transparent">
          Runtime {runtime.testVersion.id}
        </span>
      )}
    </main>
  );
}

function StartScreen({
  payload,
  cached,
  hasSavedRuntime,
  error,
  onStart,
}: {
  payload: CandidatePayload;
  cached: boolean;
  hasSavedRuntime: boolean;
  error: string | null;
  onStart: () => void;
}) {
  return (
    <div className="grid min-h-screen place-items-center p-5">
      <section className="w-full max-w-2xl rounded-3xl bg-white p-8 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-[#07579a]">
          TOEIC Candidate Runtime
        </p>
        <h1 className="mt-3 text-3xl font-bold">{payload.test.title}</h1>
        <p className="mt-3 leading-7 text-slate-600">
          Listening sẽ chạy liên tục và tự chuyển nội dung theo audio. Không thể
          tạm dừng hoặc nghe lại. Reading bắt đầu khi timeline Listening kết thúc.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat value={String(payload.test.totalQuestions)} label="Câu hỏi" />
          <Stat value={`${payload.test.durationMinutes}'`} label="Thời lượng" />
          <Stat value={cached ? "Cached" : "Verified"} label="Snapshot" />
        </div>
        {error && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button
          onClick={onStart}
          className="mt-7 w-full rounded-xl bg-[#07579a] px-5 py-4 font-bold text-white"
        >
          {hasSavedRuntime ? "Tiếp tục bài thi" : "Bắt đầu bài thi"}
        </button>
        <Link href="/tests" className="mt-4 block text-center text-sm text-slate-500">
          ← Quay lại danh sách
        </Link>
      </section>
    </div>
  );
}

function ListeningPlayer({
  payload,
  positionMs,
  audioStatus,
  answers,
  setAnswer,
}: {
  payload: CandidatePayload;
  positionMs: number;
  audioStatus: string;
  answers: Record<string, string>;
  setAnswer: (questionId: string, optionId: string) => void;
}) {
  const timeline = deriveTimelineState(payload, positionMs);
  const section =
    payload.sections.find((item) => item.id === timeline.sectionId) ??
    payload.sections.find((item) => item.kind === "LISTENING");
  const group = findGroup(payload, timeline.groupId, timeline.questionId);
  const targetQuestion = group?.questions.find(
    (question) => question.id === timeline.questionId,
  );
  const questions = targetQuestion ? [targetQuestion] : (group?.questions ?? []);
  const isDirection = timeline.event?.type === "DIRECTION";
  const isExample = timeline.event?.type === "EXAMPLE";

  return (
    <ExamShell
      title={`Listening: ${section?.part?.replace("PART_", "Part ") ?? "Listening"}`}
      meta={`${formatClock(positionMs)} · ${audioStatus}`}
    >
      <div className="grid min-h-[calc(100vh-112px)] place-items-center bg-[#f2f3f5] p-5">
        <section className="w-full max-w-5xl rounded-sm border border-slate-300 bg-white p-6 shadow-sm">
          {isDirection || isExample ? (
            <div className="mx-auto max-w-3xl py-10 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-[#07579a]">
                {isExample ? "Example" : "Directions"}
              </p>
              <h2 className="mt-5 text-2xl font-bold">
                {section?.part?.replace("PART_", "Part ")}
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-700">
                {section?.direction?.text ?? "Listen carefully and select the best answer."}
              </p>
              {isExample && section?.direction?.exampleHtml && (
                <SafeHtml html={section.direction.exampleHtml} />
              )}
            </div>
          ) : group ? (
            <div className="grid gap-7 lg:grid-cols-[minmax(280px,0.9fr)_1.1fr]">
              <div>
                <p className="mb-4 text-sm font-bold text-[#07579a]">
                  {section?.part?.replace("PART_", "Part ")}
                </p>
                {group.stimuli
                  .filter((stimulus) => stimulus.type !== "AUDIO")
                  .map((stimulus) => (
                    <Stimulus key={stimulus.id} stimulus={stimulus} />
                  ))}
                {group.stimuli.every((stimulus) => stimulus.type === "AUDIO") && (
                  <div className="grid min-h-56 place-items-center rounded-xl bg-slate-50 text-center text-slate-500">
                    <p>Listen to the audio and select the best answer.</p>
                  </div>
                )}
              </div>
              <QuestionList questions={questions} answers={answers} setAnswer={setAnswer} />
            </div>
          ) : (
            <div className="py-20 text-center text-slate-500">
              Đang chuyển sang nội dung tiếp theo…
            </div>
          )}
        </section>
      </div>
    </ExamShell>
  );
}

function ReadingPlayer({
  payload,
  answers,
  setAnswer,
}: {
  payload: CandidatePayload;
  answers: Record<string, string>;
  setAnswer: (questionId: string, optionId: string) => void;
}) {
  const pages = useMemo(
    () =>
      payload.sections
        .filter((section) => section.kind === "READING")
        .flatMap((section) =>
          section.questionGroups.flatMap((group) =>
            section.part === "PART_5"
              ? group.questions.map((question) => ({ section, group, questions: [question] }))
              : [{ section, group, questions: group.questions }],
          ),
        ),
    [payload],
  );
  const [pageIndex, setPageIndex] = useState(0);
  const [activeQuestionId, setActiveQuestionId] = useState(
    pages[0]?.questions[0]?.id ?? "",
  );
  const [flags, setFlags] = useState<string[]>([]);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const page = pages[pageIndex];
  const activeQuestion =
    page?.questions.find((question) => question.id === activeQuestionId) ??
    page?.questions[0];
  const readingQuestions = pages.flatMap((item) => item.questions);

  function go(index: number, questionId?: string) {
    const next = pages[index];
    if (!next) return;
    setPageIndex(index);
    setActiveQuestionId(questionId ?? next.questions[0]?.id ?? "");
    setCatalogOpen(false);
  }

  if (!page) return <ExamMessage title="Đề không có section Reading" />;
  const range = `${page.questions[0]?.number ?? "—"}${page.questions.length > 1 ? `–${page.questions.at(-1)?.number}` : ""}`;

  return (
    <ExamShell
      title={`Reading: Questions ${range} of ${payload.test.totalQuestions}`}
      meta={`${Object.keys(answers).length}/${readingQuestions.length}`}
      submit={() => setCatalogOpen(true)}
    >
      <div className="grid h-[calc(100vh-112px)] grid-cols-1 grid-rows-2 gap-3 bg-[#f2f3f5] p-3 md:grid-cols-2 md:grid-rows-1 md:gap-5 md:p-5">
        <section className="exam-scrollbar min-h-0 overflow-y-auto border border-slate-300 bg-white p-6">
          {page.section.part === "PART_5" ? (
            <p className="text-lg font-semibold leading-8 text-[#124b78]">
              {page.section.direction?.text ?? "Select the best answer to complete the sentence."}
            </p>
          ) : page.group.stimuli.length ? (
            page.group.stimuli.map((stimulus, index) => (
              <div key={stimulus.id} className="mb-8">
                {page.group.stimuli.length > 1 && (
                  <h2 className="mb-5 text-lg font-semibold text-[#124b78]">Passage {index + 1}</h2>
                )}
                <Stimulus stimulus={stimulus} />
              </div>
            ))
          ) : (
            <p className="text-amber-700">Passage chưa được gắn vào đề.</p>
          )}
        </section>
        <section className="exam-scrollbar min-h-0 overflow-y-auto border border-slate-300 bg-white p-5">
          <h2 className="sticky -top-5 z-10 -mx-5 -mt-5 mb-5 border-b border-slate-200 bg-white/95 px-5 py-4 font-semibold text-[#124b78]">
            Question
          </h2>
          <QuestionList
            questions={page.questions}
            answers={answers}
            setAnswer={(questionId, optionId) => {
              setActiveQuestionId(questionId);
              setAnswer(questionId, optionId);
            }}
            onActivate={setActiveQuestionId}
          />
        </section>
      </div>
      <footer className="grid h-12 grid-cols-[1fr_auto_auto] items-center border-t border-slate-300 bg-[#f4f4f4] pl-5">
        <button
          onClick={() =>
            activeQuestion &&
            setFlags((current) =>
              current.includes(activeQuestion.id)
                ? current.filter((id) => id !== activeQuestion.id)
                : [...current, activeQuestion.id],
            )
          }
          className="flex items-center gap-2 justify-self-start text-xs"
        >
          <span className={`grid size-5 place-items-center rounded border ${activeQuestion && flags.includes(activeQuestion.id) ? "border-amber-500 bg-amber-500 text-white" : "border-slate-400 bg-white"}`}>
            {activeQuestion && flags.includes(activeQuestion.id) ? "✓" : ""}
          </span>
          <span className="hidden sm:inline">Mark item for review</span>
        </button>
        <button onClick={() => setCatalogOpen(true)} className="grid h-12 w-12 place-items-center bg-[#07579a] text-lg text-white">☷</button>
        <div className="flex">
          <NavButton disabled={pageIndex === 0} onClick={() => go(pageIndex - 1)}>←</NavButton>
          <NavButton disabled={pageIndex === pages.length - 1} onClick={() => go(pageIndex + 1)}>→</NavButton>
        </div>
      </footer>
      {catalogOpen && (
        <QuestionCatalog
          payload={payload}
          pages={pages}
          answers={answers}
          flags={flags}
          activeQuestionId={activeQuestion?.id ?? ""}
          close={() => setCatalogOpen(false)}
          jump={go}
        />
      )}
    </ExamShell>
  );
}

function QuestionCatalog({
  payload,
  pages,
  answers,
  flags,
  activeQuestionId,
  close,
  jump,
}: {
  payload: CandidatePayload;
  pages: Array<{ section: CandidateSection; group: CandidateGroup; questions: CandidateQuestion[] }>;
  answers: Record<string, string>;
  flags: string[];
  activeQuestionId: string;
  close: () => void;
  jump: (index: number, questionId?: string) => void;
}) {
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-slate-950/55 p-4">
      <section className="exam-scrollbar max-h-[86vh] w-full max-w-xl overflow-y-auto rounded bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div><h2 className="text-xl font-bold text-[#07579a]">Reading</h2><p className="text-xs text-slate-500">Chọn số câu để chuyển trang.</p></div>
          <button onClick={close} className="grid size-9 place-items-center rounded-full bg-slate-100 text-xl">×</button>
        </div>
        <div className="mt-5 space-y-5">
          {payload.sections.filter((section) => section.kind === "READING").map((section) => (
            <div key={section.id}>
              <h3 className="mb-2 font-bold text-slate-700">{section.part?.replace("PART_", "Part ")}</h3>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                {section.questionGroups.flatMap((group) => group.questions).map((question) => {
                  const target = pages.findIndex((page) => page.questions.some((item) => item.id === question.id));
                  return (
                    <button
                      key={question.id}
                      onClick={() => jump(target, question.id)}
                      className={`relative aspect-square rounded border text-[11px] font-bold ${answers[question.id] ? "border-[#07579a] bg-[#07579a] text-white" : "border-slate-300"} ${activeQuestionId === question.id ? "ring-2 ring-slate-700" : ""}`}
                    >
                      {question.number}
                      {flags.includes(question.id) && <span className="absolute -right-1 -top-2 text-amber-600">⚑</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ExamShell({
  title,
  meta,
  submit,
  children,
}: {
  title: string;
  meta: string;
  submit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative h-screen overflow-hidden">
      <header className="grid h-16 grid-cols-[auto_1fr_auto] items-center gap-2 bg-[#001b47] px-3 text-white sm:gap-4 sm:px-6">
        <div className="rounded bg-white px-2 py-2 text-[10px] font-black text-[#07579a] sm:px-3 sm:text-xs">PACE<span className="text-orange-500">LINGO</span></div>
        <h1 className="truncate text-center text-xs font-bold sm:text-lg">{title}</h1>
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="rounded bg-white px-3 py-2 text-[#07579a]">{meta}</span>
          {submit && <button onClick={submit} className="rounded bg-orange-500 px-4 py-2">Submit</button>}
        </div>
      </header>
      {children}
    </div>
  );
}

function QuestionList({
  questions,
  answers,
  setAnswer,
  onActivate,
}: {
  questions: CandidateQuestion[];
  answers: Record<string, string>;
  setAnswer: (questionId: string, optionId: string) => void;
  onActivate?: (questionId: string) => void;
}) {
  return (
    <div className="space-y-8">
      {questions.map((question) => (
        <article key={question.id} onClick={() => onActivate?.(question.id)}>
          <div className="flex gap-3"><strong>{question.number}.</strong><SafeHtml html={question.promptHtml} compact /></div>
          <div className="mt-3 space-y-2 pl-8">
            {question.options.map((option) => (
              <label key={option.id} className={`flex cursor-pointer items-center gap-3 border px-4 py-3 ${answers[question.id] === option.id ? "border-[#2b69a9] bg-blue-50" : "border-slate-200"}`}>
                <input type="radio" name={question.id} checked={answers[question.id] === option.id} onChange={() => setAnswer(question.id, option.id)} className="size-4 accent-[#07579a]" />
                <span><strong>({option.label})</strong> <HtmlText html={option.contentHtml} /></span>
              </label>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function Stimulus({ stimulus }: { stimulus: CandidateStimulus }) {
  if (stimulus.type === "HTML") return <SafeHtml html={stimulus.contentHtml ?? ""} />;
  if (stimulus.type === "IMAGE") {
    return stimulus.media ? <img src={stimulus.media.url} alt={stimulus.altText ?? stimulus.media.altText ?? "TOEIC stimulus"} className="mx-auto max-h-[520px] max-w-full object-contain" /> : <p className="rounded bg-amber-50 p-3 text-amber-700">{stimulus.altText ?? "Ảnh chưa được gắn"}</p>;
  }
  return null;
}

function SafeHtml({ html, compact = false }: { html: string; compact?: boolean }) {
  const textLength = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").length;
  const blocks = (html.match(/<(p|div|article|table|tr|li|header|section)\b/gi) ?? []).length;
  const height = compact
    ? Math.min(300, Math.max(32, Math.ceil(textLength / 65) * 24 + blocks * 10 + 4))
    : Math.min(5000, Math.max(180, Math.ceil(textLength / 55) * 25 + blocks * 18 + 70));
  return <iframe sandbox="" scrolling="no" srcDoc={`<!doctype html><meta charset="utf-8"><style>html,body{overflow:hidden}body{font:15px/1.6 Arial;margin:0;color:#172033}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:7px}img{max-width:100%}</style>${html}`} style={{ height }} className="block w-full border-0 bg-white" title="Candidate content" />;
}

function HtmlText({ html }: { html: string }) {
  return <>{html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}</>;
}

function NavButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button disabled={disabled} onClick={onClick} className="grid h-12 w-12 place-items-center bg-[#55a43b] text-lg font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">{children}</button>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return <div className="rounded-xl bg-slate-50 p-4"><strong className="text-xl text-[#07579a]">{value}</strong><p className="mt-1 text-xs text-slate-500">{label}</p></div>;
}

function ExamMessage({ title, detail }: { title: string; detail?: string }) {
  return <main className="grid min-h-screen place-items-center bg-[#e9eaec] p-5"><div className="rounded-2xl bg-white p-8 text-center shadow-xl"><h1 className="text-xl font-bold">{title}</h1>{detail && <p className="mt-3 max-w-lg text-sm text-red-600">{detail}</p>}<Link href="/tests" className="mt-5 block text-sm text-[#07579a]">← Danh sách đề</Link></div></main>;
}

function findGroup(payload: CandidatePayload, groupId: string | null, questionId: string | null) {
  return payload.sections.flatMap((section) => section.questionGroups).find((group) => group.id === groupId || (questionId ? group.questions.some((question) => question.id === questionId) : false));
}

function formatClock(value: number) {
  const seconds = Math.floor(value / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function localStorageSafe(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}

async function responseMessage(response: Response) {
  const payload = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
  return Array.isArray(payload?.message) ? payload.message.join(", ") : payload?.message ?? `Request failed (${response.status})`;
}

function ensureMediaReady(audio: HTMLAudioElement) {
  if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Không tải được metadata của full audio"));
    };
    const cleanup = () => {
      audio.removeEventListener("loadedmetadata", onReady);
      audio.removeEventListener("error", onError);
    };
    audio.addEventListener("loadedmetadata", onReady, { once: true });
    audio.addEventListener("error", onError, { once: true });
    audio.load();
  });
}
