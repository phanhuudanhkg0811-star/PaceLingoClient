"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/auth-client";
import {
  deleteAttemptCache,
  readAttemptCache,
  writeAttemptCache,
} from "@/lib/attempt-cache";
import { loadCandidateSnapshot } from "@/lib/candidate-loader";
import type {
  AttemptAnswer,
  AttemptTiming,
  CandidateAttempt,
  CandidateGroup,
  CandidateManifest,
  CandidatePayload,
  CandidateQuestion,
  CandidateSection,
  CandidateStimulus,
} from "@/lib/candidate-types";
import { deriveTimelineState, listeningDurationMs } from "@/lib/timeline-runtime";

type Stage = "loading" | "ready" | "listening" | "reading" | "submitted" | "error";

export function CandidateExam({ testId }: { testId: string }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [manifest, setManifest] = useState<CandidateManifest | null>(null);
  const [payload, setPayload] = useState<CandidatePayload | null>(null);
  const [attempt, setAttempt] = useState<CandidateAttempt | null>(null);
  const [positionMs, setPositionMs] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<string[]>([]);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheSource, setCacheSource] = useState<"network" | "cache" | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const highestPositionRef = useRef(0);
  const attemptRef = useRef<CandidateAttempt | null>(null);
  const answerRecordsRef = useRef<Record<string, AttemptAnswer>>({});
  const timingRecordsRef = useRef<Record<string, AttemptTiming>>({});
  const pendingAnswersRef = useRef<Record<string, AttemptAnswer>>({});
  const pendingTimingsRef = useRef<Record<string, AttemptTiming>>({});
  const timingSessionRef = useRef<{ questionId: string; startedAt: number } | null>(null);
  const serverOffsetRef = useRef(0);
  const flushPromiseRef = useRef<Promise<void> | null>(null);

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

  const startOrResume = useCallback(async () => {
    if (!payload) return;
    setError(null);
    try {
      const response = await apiFetch(`/tests/${testId}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const nextAttempt = (await response.json()) as CandidateAttempt;
      attemptRef.current = nextAttempt;
      setAttempt(nextAttempt);
      serverOffsetRef.current =
        new Date(nextAttempt.serverNow).getTime() - Date.now();
      setRemainingMs(
        Math.max(
          0,
          new Date(nextAttempt.expiresAt).getTime() -
            (Date.now() + serverOffsetRef.current),
        ),
      );

      const serverAnswers = Object.fromEntries(
        nextAttempt.answers.map((item) => [item.questionId, item]),
      );
      const serverTimings = Object.fromEntries(
        nextAttempt.timings.map((item) => [item.questionId, item]),
      );
      const local = await readAttemptCache(nextAttempt.id);
      for (const item of Object.values(local?.answers ?? {})) {
        if ((serverAnswers[item.questionId]?.clientSequence ?? -1) < item.clientSequence) {
          serverAnswers[item.questionId] = item;
          pendingAnswersRef.current[item.questionId] = item;
        }
      }
      for (const item of Object.values(local?.timings ?? {})) {
        if ((serverTimings[item.questionId]?.clientSequence ?? -1) < item.clientSequence) {
          serverTimings[item.questionId] = item;
          pendingTimingsRef.current[item.questionId] = item;
        }
      }
      answerRecordsRef.current = serverAnswers;
      timingRecordsRef.current = serverTimings;
      setAnswers(
        Object.fromEntries(
          Object.values(serverAnswers)
            .filter((item) => item.selectedOptionId)
            .map((item) => [item.questionId, item.selectedOptionId!]),
        ),
      );
      setFlags(
        Object.values(serverAnswers)
          .filter((item) => item.isFlagged)
          .map((item) => item.questionId),
      );

      if (nextAttempt.status !== "IN_PROGRESS") {
        await deleteAttemptCache(nextAttempt.id);
        setStage("submitted");
        return;
      }

      const listeningEnd = listeningDurationMs(payload);
      const serverNow = Date.now() + serverOffsetRef.current;
      if (
        !payload.test.fullListeningAudio ||
        listeningEnd === 0 ||
        !nextAttempt.listeningEndsAt ||
        serverNow >= new Date(nextAttempt.listeningEndsAt).getTime()
      ) {
        setStage("reading");
        return;
      }

      const audio = audioRef.current;
      if (!audio) throw new Error("Audio player chưa sẵn sàng");
      const expectedMs = Math.min(
        listeningEnd,
        Math.max(0, serverNow - new Date(nextAttempt.startedAt).getTime()),
      );
      const expectedSeconds = expectedMs / 1000;
      await ensureMediaReady(audio);
      audio.currentTime = expectedSeconds;
      highestPositionRef.current = expectedSeconds;
      setPositionMs(expectedMs);
      setStage("listening");
      await audio.play();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể bắt đầu bài thi");
      setStage("ready");
    }
  }, [payload, testId]);

  const persistLocal = useCallback(() => {
    const current = attemptRef.current;
    if (!current) return;
    void writeAttemptCache({
      attemptId: current.id,
      answers: answerRecordsRef.current,
      timings: timingRecordsRef.current,
      updatedAt: Date.now(),
    });
  }, []);

  const flushPending = useCallback((keepalive = false) => {
    const current = attemptRef.current;
    if (!current || current.status !== "IN_PROGRESS") return Promise.resolve();
    if (flushPromiseRef.current) return flushPromiseRef.current;
    const answersToSend = Object.values(pendingAnswersRef.current);
    const timingsToSend = Object.values(pendingTimingsRef.current);
    if (!answersToSend.length && !timingsToSend.length) return Promise.resolve();
    const request = apiFetch(`/attempts/${current.id}/answers`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: answersToSend.map(toAnswerInput),
        timings: timingsToSend,
      }),
      keepalive,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseMessage(response));
        for (const sent of answersToSend) {
          if (pendingAnswersRef.current[sent.questionId]?.clientSequence === sent.clientSequence) {
            delete pendingAnswersRef.current[sent.questionId];
          }
        }
        for (const sent of timingsToSend) {
          if (pendingTimingsRef.current[sent.questionId]?.clientSequence === sent.clientSequence) {
            delete pendingTimingsRef.current[sent.questionId];
          }
        }
      })
      .catch((reason) => {
        throw reason;
      })
      .finally(() => {
        flushPromiseRef.current = null;
      });
    flushPromiseRef.current = request;
    return request;
  }, []);

  const setAnswer = useCallback(
    (questionId: string, optionId: string) => {
      const previous = answerRecordsRef.current[questionId];
      const next: AttemptAnswer = {
        questionId,
        selectedOptionId: optionId,
        isFlagged: previous?.isFlagged ?? false,
        answeredAt: new Date().toISOString(),
        clientSequence: (previous?.clientSequence ?? 0) + 1,
      };
      answerRecordsRef.current[questionId] = next;
      pendingAnswersRef.current[questionId] = next;
      setAnswers((current) => ({ ...current, [questionId]: optionId }));
      persistLocal();
      if (Object.keys(pendingAnswersRef.current).length >= 5) {
        void flushPending().catch(() => undefined);
      }
    },
    [flushPending, persistLocal],
  );

  const toggleFlag = useCallback(
    (questionId: string) => {
      const previous = answerRecordsRef.current[questionId];
      const next: AttemptAnswer = {
        questionId,
        selectedOptionId: previous?.selectedOptionId ?? null,
        isFlagged: !(previous?.isFlagged ?? false),
        answeredAt: previous?.answeredAt ?? null,
        clientSequence: (previous?.clientSequence ?? 0) + 1,
      };
      answerRecordsRef.current[questionId] = next;
      pendingAnswersRef.current[questionId] = next;
      setFlags((current) =>
        next.isFlagged
          ? [...new Set([...current, questionId])]
          : current.filter((id) => id !== questionId),
      );
      persistLocal();
    },
    [persistLocal],
  );

  const stopTiming = useCallback(() => {
    const session = timingSessionRef.current;
    if (!session) return;
    timingSessionRef.current = null;
    const previous = timingRecordsRef.current[session.questionId];
    const now = new Date().toISOString();
    const next: AttemptTiming = {
      questionId: session.questionId,
      activeTimeMs:
        (previous?.activeTimeMs ?? 0) +
        Math.max(0, Math.round(performance.now() - session.startedAt)),
      visitCount: previous?.visitCount ?? 1,
      firstViewedAt: previous?.firstViewedAt ?? now,
      lastViewedAt: now,
      clientSequence: (previous?.clientSequence ?? 0) + 1,
    };
    timingRecordsRef.current[session.questionId] = next;
    pendingTimingsRef.current[session.questionId] = next;
    persistLocal();
  }, [persistLocal]);

  const startTiming = useCallback((questionId: string | null, countVisit = true) => {
    if (!questionId || document.visibilityState !== "visible") return;
    const previous = timingRecordsRef.current[questionId];
    const now = new Date().toISOString();
    const next: AttemptTiming = {
      questionId,
      activeTimeMs: previous?.activeTimeMs ?? 0,
      visitCount: (previous?.visitCount ?? 0) + (countVisit ? 1 : 0),
      firstViewedAt: previous?.firstViewedAt ?? now,
      lastViewedAt: now,
      clientSequence: (previous?.clientSequence ?? 0) + 1,
    };
    timingRecordsRef.current[questionId] = next;
    pendingTimingsRef.current[questionId] = next;
    timingSessionRef.current = { questionId, startedAt: performance.now() };
  }, []);

  useEffect(() => {
    stopTiming();
    if (stage === "listening" || stage === "reading") startTiming(activeQuestionId);
    return stopTiming;
  }, [activeQuestionId, stage, startTiming, stopTiming]);

  useEffect(() => {
    if (!attempt || attempt.status !== "IN_PROGRESS") return;
    const tick = () =>
      setRemainingMs(
        Math.max(
          0,
          new Date(attempt.expiresAt).getTime() -
            (Date.now() + serverOffsetRef.current),
        ),
      );
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [attempt]);

  useEffect(() => {
    if (!attempt || attempt.status !== "IN_PROGRESS") return;
    const flushTimer = window.setInterval(() => {
      stopTiming();
      startTiming(activeQuestionId, false);
      void flushPending().catch(() => undefined);
    }, 4_000);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        stopTiming();
        void flushPending(true).catch(() => undefined);
      } else {
        startTiming(activeQuestionId, false);
      }
    };
    const onOnline = () => void flushPending().catch(() => undefined);
    const onBeforeUnload = () => {
      stopTiming();
      void flushPending(true).catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.clearInterval(flushTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [activeQuestionId, attempt, flushPending, startTiming, stopTiming]);

  const saveProgress = useCallback(
    (section: "LISTENING" | "READING", questionId: string | null) => {
      const current = attemptRef.current;
      if (!current || current.status !== "IN_PROGRESS") return;
      void apiFetch(`/attempts/${current.id}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentSection: section, currentQuestionId: questionId }),
      }).catch(() => undefined);
    },
    [],
  );

  const onListeningActive = useCallback(
    (questionId: string | null) => {
      setActiveQuestionId(questionId);
      saveProgress("LISTENING", questionId);
    },
    [saveProgress],
  );

  const onReadingActive = useCallback(
    (questionId: string) => {
      setActiveQuestionId(questionId);
      saveProgress("READING", questionId);
    },
    [saveProgress],
  );

  const submitAttempt = useCallback(async () => {
    const current = attemptRef.current;
    if (!current || submitting) return;
    setSubmitting(true);
    setError(null);
    stopTiming();
    try {
      const expired =
        Date.now() + serverOffsetRef.current >=
        new Date(current.expiresAt).getTime();
      if (!expired) {
        do {
          await flushPending();
        } while (
          Object.keys(pendingAnswersRef.current).length > 0 ||
          Object.keys(pendingTimingsRef.current).length > 0
        );
      }
      const response = await apiFetch(`/attempts/${current.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: [], timings: [] }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const finished = (await response.json()) as CandidateAttempt;
      attemptRef.current = finished;
      setAttempt(finished);
      await deleteAttemptCache(finished.id);
      audioRef.current?.pause();
      setStage("submitted");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể nộp bài");
    } finally {
      setSubmitting(false);
    }
  }, [flushPending, stopTiming, submitting]);

  useEffect(() => {
    if (attempt?.status === "IN_PROGRESS" && remainingMs <= 0 && !submitting) {
      void submitAttempt();
    }
  }, [attempt?.status, remainingMs, submitAttempt, submitting]);

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
        if (payload.sections.some((section) => section.kind === "READING")) {
          setStage("reading");
          saveProgress("READING", null);
        } else {
          void submitAttempt();
        }
        return;
      }
      if (!audio.paused && document.visibilityState === "visible") {
        frame = requestAnimationFrame(sync);
      }
    };
    const onPlaying = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };
    const onTimeUpdate = () => sync();
    const onVisibility = () => sync();
    const onSeeking = () => {
      if (audio.currentTime + 0.75 < highestPositionRef.current) {
        audio.currentTime = highestPositionRef.current;
      }
    };
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("seeking", onSeeking);
    document.addEventListener("visibilitychange", onVisibility);
    frame = requestAnimationFrame(sync);
    return () => {
      cancelAnimationFrame(frame);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("seeking", onSeeking);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [payload, saveProgress, stage, submitAttempt]);

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
          onEnded={() => {
            if (payload.sections.some((section) => section.kind === "READING")) {
              setStage("reading");
              saveProgress("READING", null);
            } else {
              void submitAttempt();
            }
          }}
          className="hidden"
        />
      )}

      {stage === "ready" && (
        <StartScreen
          payload={payload}
          cached={cacheSource === "cache"}
          hasSavedRuntime={false}
          error={error}
          onStart={() => void startOrResume()}
        />
      )}
      {stage === "listening" && (
        <ListeningPlayer
          payload={payload}
          positionMs={positionMs}
          remainingMs={remainingMs}
          answers={answers}
          setAnswer={setAnswer}
          onActiveQuestion={onListeningActive}
        />
      )}
      {stage === "reading" && (
        <ReadingPlayer
          payload={payload}
          remainingMs={remainingMs}
          answers={answers}
          flags={flags}
          setAnswer={setAnswer}
          toggleFlag={toggleFlag}
          onActiveQuestion={onReadingActive}
          onSubmit={() => void submitAttempt()}
          submitting={submitting}
          initialQuestionId={attempt?.currentQuestionId ?? null}
        />
      )}
      {stage === "submitted" && attempt && (
        <ResultScreen payload={payload} attempt={attempt} />
      )}
      {error && stage !== "ready" && (
        <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded bg-red-600 px-4 py-2 text-sm text-white shadow-lg">
          {error}
        </div>
      )}
      {submitting && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/45">
          <div className="rounded-xl bg-white px-6 py-4 font-bold text-[#07579a] shadow-2xl">
            Đang lưu và nộp bài…
          </div>
        </div>
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

function ResultScreen({
  payload,
  attempt,
}: {
  payload: CandidatePayload;
  attempt: CandidateAttempt;
}) {
  const listeningTotal = payload.sections
    .filter((section) => section.kind === "LISTENING")
    .flatMap((section) => section.questionGroups)
    .flatMap((group) => group.questions).length;
  const readingTotal = payload.sections
    .filter((section) => section.kind === "READING")
    .flatMap((section) => section.questionGroups)
    .flatMap((group) => group.questions).length;
  const listeningCorrect = attempt.listeningCorrect ?? 0;
  const readingCorrect = attempt.readingCorrect ?? 0;
  const listeningScore = sectionScore(
    attempt.listeningScore,
    listeningCorrect,
    listeningTotal,
  );
  const readingScore = sectionScore(
    attempt.readingScore,
    readingCorrect,
    readingTotal,
  );
  const sectionCount = Number(listeningTotal > 0) + Number(readingTotal > 0);
  const maximumScore = sectionCount * 495;
  const minimumScore = sectionCount * 5;
  const totalScore =
    attempt.totalScore ?? (listeningScore ?? 0) + (readingScore ?? 0);
  const isEstimated =
    attempt.totalScore === null ||
    (listeningTotal > 0 && attempt.listeningScore === null) ||
    (readingTotal > 0 && attempt.readingScore === null);

  return (
    <div className="min-h-screen bg-white text-slate-800">
      <section className="flex min-h-screen w-full flex-col overflow-hidden bg-white">
        <header className="grid h-16 grid-cols-[44px_1fr_44px] items-center bg-[#001b47] px-4 text-white">
          <Link
            href="/tests"
            aria-label="Quay lại danh sách đề"
            className="grid size-8 place-items-center rounded-full border border-white/70 text-lg transition-colors hover:bg-white/10"
          >
            ←
          </Link>
          <h1 className="text-center text-lg font-bold">Result</h1>
        </header>

        <div className="flex-1 bg-[radial-gradient(circle_at_top,#ffffff_0%,#f7f9fb_58%,#edf1f5_100%)] px-4 py-8 sm:px-10 sm:py-10">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
              {attempt.status === "AUTO_SUBMITTED"
                ? "Hết giờ · Đã tự động nộp bài"
                : "Đã hoàn thành bài thi"}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[#082c59]">
              {isEstimated ? "Điểm TOEIC ước tính" : "Điểm TOEIC quy đổi"}
            </h2>
          </div>

          <div className="mx-auto mt-7 max-w-xl rounded-lg border-2 border-[#78aee0] bg-[#f7fbff] px-6 py-5 shadow-sm">
            <p className="text-center text-sm font-semibold text-slate-500">Your score</p>
            <p className="mt-1 text-center text-4xl font-black text-[#0b4f8a]">
              {totalScore}
              <span className="ml-1 text-base font-bold text-slate-400">/{maximumScore}</span>
            </p>
            <ScoreRail
              score={totalScore}
              minimum={minimumScore}
              maximum={maximumScore}
              color="#1677c8"
            />
          </div>

          <div className={`mx-auto mt-6 grid max-w-4xl gap-5 ${listeningTotal > 0 && readingTotal > 0 ? "md:grid-cols-2" : "max-w-2xl"}`}>
            {listeningTotal > 0 && listeningScore !== null && (
              <ResultSectionCard
                title="Listening"
                score={listeningScore}
                correct={listeningCorrect}
                total={listeningTotal}
                accent="#1677c8"
                tint="#dceeff"
              />
            )}
            {readingTotal > 0 && readingScore !== null && (
              <ResultSectionCard
                title="Reading"
                score={readingScore}
                correct={readingCorrect}
                total={readingTotal}
                accent="#4f6fc7"
                tint="#e9efff"
              />
            )}
          </div>

          <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-5 text-slate-500">
            {isEstimated
              ? "Điểm được ước tính từ tỷ lệ câu đúng để mô phỏng thang TOEIC. Đây không phải bảng điểm chính thức và có thể thay đổi khi đề được gắn bảng quy đổi riêng."
              : "Điểm được tính bằng bảng quy đổi đã cấu hình cho phiên bản đề này."}
          </p>
        </div>

        <footer className="flex min-h-16 items-center justify-center border-t border-slate-200 bg-[#f3f4f6] px-4 py-3">
          <Link
            href="/tests"
            className="rounded-md bg-[#07579a] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#064a82]"
          >
            Back
          </Link>
        </footer>
      </section>
    </div>
  );
}

function ResultSectionCard({
  title,
  score,
  correct,
  total,
  accent,
  tint,
}: {
  title: string;
  score: number;
  correct: number;
  total: number;
  accent: string;
  tint: string;
}) {
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <header
        className="flex items-center justify-between px-5 py-3 font-bold text-[#163f68]"
        style={{ backgroundColor: tint }}
      >
        <span className="flex items-center gap-2">
          <span
            className="grid size-6 place-items-center rounded-full text-xs font-black text-white"
            style={{ backgroundColor: accent }}
          >
            {title.charAt(0)}
          </span>
          {title}
        </span>
        <span className="text-xs text-slate-500">{correct}/{total} correct</span>
      </header>
      <div className="px-6 py-5">
        <p className="text-center text-sm font-semibold text-slate-500">Your score</p>
        <p className="mt-1 text-center text-3xl font-black" style={{ color: accent }}>
          {score}
          <span className="ml-1 text-sm text-slate-400">/495</span>
        </p>
        <ScoreRail score={score} minimum={5} maximum={495} color={accent} />
        <div className="mt-5 rounded-md bg-slate-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Performance · {percentage}%
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {scoreFeedback(title, percentage)}
          </p>
        </div>
      </div>
    </article>
  );
}

function ScoreRail({
  score,
  minimum,
  maximum,
  color,
}: {
  score: number;
  minimum: number;
  maximum: number;
  color: string;
}) {
  const position = Math.min(
    100,
    Math.max(0, ((score - minimum) / Math.max(1, maximum - minimum)) * 100),
  );
  return (
    <div className="mt-5">
      <div className="mb-1 flex justify-between text-[11px] font-bold text-slate-500">
        <span>{minimum}</span>
        <span>{maximum}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-slate-200">
        <div
          className="h-full rounded-full"
          style={{ width: `${position}%`, backgroundColor: color }}
        />
        <span
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${position}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function sectionScore(serverScore: number | null, correct: number, total: number) {
  if (total <= 0) return null;
  if (serverScore !== null) return serverScore;
  const estimated = 5 + (correct / total) * 490;
  return Math.min(495, Math.max(5, Math.round(estimated / 5) * 5));
}

function scoreFeedback(section: string, percentage: number) {
  const skill = section === "Listening" ? "nghe hiểu" : "đọc hiểu";
  if (percentage >= 85) {
    return `Năng lực ${skill} rất tốt. Bạn xử lý ổn cả chi tiết và ý chính trong phần này.`;
  }
  if (percentage >= 70) {
    return `Năng lực ${skill} khá tốt. Hãy rà lại những dạng câu dễ mất điểm để tiến gần mốc cao hơn.`;
  }
  if (percentage >= 50) {
    return `Bạn đã nắm được nền tảng ${skill}. Nên xem lại câu sai và luyện thêm theo từng Part.`;
  }
  return `Bạn nên củng cố nền tảng ${skill}, làm lại các câu sai và luyện từng nhóm câu ngắn trước.`;
}

function ListeningPlayer({
  payload,
  positionMs,
  remainingMs,
  answers,
  setAnswer,
  onActiveQuestion,
}: {
  payload: CandidatePayload;
  positionMs: number;
  remainingMs: number;
  answers: Record<string, string>;
  setAnswer: (questionId: string, optionId: string) => void;
  onActiveQuestion: (questionId: string | null) => void;
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
  const activeTimelineQuestionId = targetQuestion?.id ?? questions[0]?.id ?? null;
  const isDirection = timeline.event?.type === "DIRECTION";
  const isExample = timeline.event?.type === "EXAMPLE";
  const totalQuestionCount = countQuestions(payload);
  const answeredCount = Object.keys(answers).length;

  useEffect(() => {
    onActiveQuestion(activeTimelineQuestionId);
  }, [activeTimelineQuestionId, onActiveQuestion]);

  return (
    <ExamShell
      title={`Listening: ${section?.part?.replace("PART_", "Part ") ?? "Listening"}`}
      progress={`${answeredCount}/${totalQuestionCount}`}
      timer={formatClock(remainingMs)}
    >
      <div className="grid min-h-[calc(100vh-64px)] place-items-center bg-[#f2f3f5] p-5">
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
              <QuestionList
                questions={questions}
                answers={answers}
                setAnswer={setAnswer}
                onActivate={onActiveQuestion}
              />
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
  remainingMs,
  answers,
  flags,
  setAnswer,
  toggleFlag,
  onActiveQuestion,
  onSubmit,
  submitting,
  initialQuestionId,
}: {
  payload: CandidatePayload;
  remainingMs: number;
  answers: Record<string, string>;
  flags: string[];
  setAnswer: (questionId: string, optionId: string) => void;
  toggleFlag: (questionId: string) => void;
  onActiveQuestion: (questionId: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  initialQuestionId: string | null;
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
  const initialPageIndex = Math.max(
    0,
    pages.findIndex((item) =>
      item.questions.some((question) => question.id === initialQuestionId),
    ),
  );
  const [pageIndex, setPageIndex] = useState(initialPageIndex);
  const [activeQuestionId, setActiveQuestionId] = useState(
    initialQuestionId ?? pages[initialPageIndex]?.questions[0]?.id ?? "",
  );
  const [catalogOpen, setCatalogOpen] = useState(false);
  const lastQuestionNumber = Math.max(
    payload.test.totalQuestions,
    ...pages.flatMap((item) => item.questions.map((question) => question.number)),
  );
  const totalQuestionCount = countQuestions(payload);
  const answeredCount = Object.keys(answers).length;
  const page = pages[pageIndex];
  const activeQuestion =
    page?.questions.find((question) => question.id === activeQuestionId) ??
    page?.questions[0];
  function go(index: number, questionId?: string) {
    const next = pages[index];
    if (!next) return;
    setPageIndex(index);
    const nextQuestionId = questionId ?? next.questions[0]?.id ?? "";
    setActiveQuestionId(nextQuestionId);
    if (nextQuestionId) onActiveQuestion(nextQuestionId);
    setCatalogOpen(false);
  }

  useEffect(() => {
    if (activeQuestion?.id) onActiveQuestion(activeQuestion.id);
  }, [activeQuestion?.id, onActiveQuestion]);

  if (!page) return <ExamMessage title="Đề không có section Reading" />;
  const range = `${page.questions[0]?.number ?? "—"}${page.questions.length > 1 ? `–${page.questions.at(-1)?.number}` : ""}`;

  return (
    <ExamShell
      title={`Reading: Questions ${range} of ${lastQuestionNumber}`}
      progress={`${answeredCount}/${totalQuestionCount}`}
      timer={formatClock(remainingMs)}
      submit={() => setCatalogOpen(true)}
    >
      <div className="grid h-[calc(100vh-120px)] grid-cols-1 grid-rows-2 gap-3 bg-[#f2f3f5] p-3 md:grid-cols-2 md:grid-rows-1 md:gap-5 md:px-5 md:py-4">
        <section className="exam-scrollbar min-h-0 overflow-y-auto border border-[#d7dde6] bg-white p-6 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
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
        <section className="exam-scrollbar min-h-0 overflow-y-auto border border-[#d7dde6] bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
          <h2 className="sticky -top-5 z-10 -mx-5 -mt-5 mb-5 border-b border-slate-200 bg-white/95 px-5 py-4 font-semibold text-[#124b78]">
            Question
          </h2>
          <QuestionList
            questions={page.questions}
            answers={answers}
            setAnswer={(questionId, optionId) => {
              setActiveQuestionId(questionId);
              onActiveQuestion(questionId);
              setAnswer(questionId, optionId);
            }}
            onActivate={(questionId) => {
              setActiveQuestionId(questionId);
              onActiveQuestion(questionId);
            }}
          />
        </section>
      </div>
      <footer className="grid h-14 grid-cols-[1fr_auto_auto] items-center border-t border-[#cfd5dd] bg-[#f7f7f7] pl-5 shadow-[0_-1px_3px_rgb(15_23_42/5%)] sm:pl-7">
        <button
          onClick={() => activeQuestion && toggleFlag(activeQuestion.id)}
          className="group flex h-full items-center gap-3 justify-self-start pr-5 text-sm font-medium text-slate-700"
        >
          <span className={`grid size-7 place-items-center rounded-md border-2 text-sm shadow-sm transition-colors ${activeQuestion && flags.includes(activeQuestion.id) ? "border-[#1677c8] bg-[#1677c8] text-white" : "border-slate-400 bg-white group-hover:border-[#07579a]"}`}>
            {activeQuestion && flags.includes(activeQuestion.id) ? "✓" : ""}
          </span>
          <span>Mark item for review</span>
        </button>
        <button onClick={() => setCatalogOpen(true)} aria-label="Question list" className="grid h-14 w-14 place-items-center bg-[#07579a] text-xl text-white transition-colors hover:bg-[#064a82]">☷</button>
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
          submit={onSubmit}
          submitting={submitting}
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
  submit,
  submitting,
}: {
  payload: CandidatePayload;
  pages: Array<{ section: CandidateSection; group: CandidateGroup; questions: CandidateQuestion[] }>;
  answers: Record<string, string>;
  flags: string[];
  activeQuestionId: string;
  close: () => void;
  jump: (index: number, questionId?: string) => void;
  submit: () => void;
  submitting: boolean;
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
                      {flags.includes(question.id) && <span className="absolute -right-1 -top-2 text-[#1677c8]">⚑</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            onClick={close}
            className="rounded border border-[#07579a] px-4 py-2 text-sm font-bold text-[#07579a]"
          >
            Review
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="rounded bg-[#1677c8] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#0b5fa5] disabled:opacity-60"
          >
            {submitting ? "Đang nộp…" : "Finish test"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ExamShell({
  title,
  progress,
  timer,
  submit,
  children,
}: {
  title: string;
  progress: string;
  timer: string;
  submit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative h-screen overflow-hidden">
      <header className="grid h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 bg-[#001b47] px-3 text-white shadow-sm sm:gap-4 sm:px-6">
        <div className="rounded-md bg-white px-2 py-2 text-[10px] font-black text-[#07579a] shadow-sm sm:px-3 sm:text-xs">PACE<span className="text-[#2493dd]">LINGO</span></div>
        <h1 className="truncate text-center text-xs font-bold sm:text-lg">{title}</h1>
        <div className="flex items-center gap-2 text-xs font-bold tabular-nums">
          <span className="hidden min-w-[68px] rounded-md bg-white px-3 py-2 text-center text-[#07579a] shadow-sm sm:inline-block">
            {progress}
          </span>
          <span className="flex min-w-[92px] items-center justify-center gap-1.5 rounded-md bg-[#2f86d6] px-3 py-2 text-white shadow-sm">
            <ClockIcon />
            {timer}
          </span>
          {submit && <button onClick={submit} className="rounded-md bg-[#1677c8] px-4 py-2 text-white shadow-sm transition-colors hover:bg-[#0b5fa5]">Submit</button>}
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

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NavButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button disabled={disabled} onClick={onClick} className="grid h-14 w-14 place-items-center bg-[#1677c8] text-xl font-bold text-white transition-colors hover:bg-[#0b5fa5] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-100">{children}</button>;
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

function countQuestions(payload: CandidatePayload) {
  return payload.sections.reduce(
    (sectionTotal, section) =>
      sectionTotal +
      section.questionGroups.reduce(
        (groupTotal, group) => groupTotal + group.questions.length,
        0,
      ),
    0,
  );
}

function formatClock(value: number) {
  const seconds = Math.max(0, Math.floor(value / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const tail = `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return hours > 0 ? `${String(hours).padStart(2, "0")}:${tail}` : tail;
}

function toAnswerInput(answer: AttemptAnswer) {
  return {
    questionId: answer.questionId,
    optionId: answer.selectedOptionId,
    isFlagged: answer.isFlagged,
    answeredAt: answer.answeredAt,
    clientSequence: answer.clientSequence,
  };
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
