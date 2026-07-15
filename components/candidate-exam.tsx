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
  AttemptPartResult,
  AttemptResult,
  AttemptTiming,
  CandidateAttempt,
  CandidateGroup,
  CandidateManifest,
  CandidatePayload,
  CandidateQuestion,
  CandidateSection,
  CandidateStimulus,
} from "@/lib/candidate-types";
import {
  deriveTimelineState,
  listeningDurationMs,
} from "@/lib/timeline-runtime";
import {
  buildSegmentedListeningSteps,
  hasSegmentedListening,
  segmentedStartIndex,
} from "@/lib/segmented-listening";
import {
  LISTENING_INTRO,
  PART_1_EXAMPLE_TEXT,
  READING_INTRO,
  partDirection,
} from "@/lib/toeic-directions";

type Stage =
  "loading" | "ready" | "listening" | "reading" | "submitted" | "error";

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
  const [audioTestPlaying, setAudioTestPlaying] = useState(false);
  const [segmentedStartQuestionId, setSegmentedStartQuestionId] = useState<
    string | null
  >(null);
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [resumeChoiceOpen, setResumeChoiceOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheSource, setCacheSource] = useState<"network" | "cache" | null>(
    null,
  );
  const audioRef = useRef<HTMLAudioElement>(null);
  const highestPositionRef = useRef(0);
  const attemptRef = useRef<CandidateAttempt | null>(null);
  const answerRecordsRef = useRef<Record<string, AttemptAnswer>>({});
  const timingRecordsRef = useRef<Record<string, AttemptTiming>>({});
  const pendingAnswersRef = useRef<Record<string, AttemptAnswer>>({});
  const pendingTimingsRef = useRef<Record<string, AttemptTiming>>({});
  const timingSessionRef = useRef<{
    questionId: string;
    startedAt: number;
  } | null>(null);
  const serverOffsetRef = useRef(0);
  const flushPromiseRef = useRef<Promise<void> | null>(null);
  const resumableAttemptIdRef = useRef<string | null>(null);

  const playAudioTest = useCallback(() => {
    if (audioTestPlaying) return;
    setAudioTestPlaying(true);
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const panner = context.createStereoPanner();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(440, context.currentTime);
      oscillator.frequency.setValueAtTime(620, context.currentTime + 0.8);
      panner.pan.setValueAtTime(-0.65, context.currentTime);
      panner.pan.linearRampToValueAtTime(0.65, context.currentTime + 1.6);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.08);
      gain.gain.setValueAtTime(0.18, context.currentTime + 1.45);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.6);
      oscillator.connect(gain).connect(panner).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 1.62);
      oscillator.onended = () => {
        void context.close();
        setAudioTestPlaying(false);
      };
    } catch {
      setAudioTestPlaying(false);
      setError("Trình duyệt không thể phát âm thanh kiểm tra");
    }
  }, [audioTestPlaying]);

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
        setError(
          reason instanceof Error ? reason.message : "Không tải được đề",
        );
        setStage("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [testId]);

  const startOrResume = useCallback(async (
    mode: "ask" | "continue" | "restart" = "ask",
  ) => {
    if (!payload) return;
    setError(null);
    setStarting(true);
    try {
      const response = await apiFetch(`/tests/${testId}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restart: mode === "restart" }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const nextAttempt = (await response.json()) as CandidateAttempt;
      if (mode === "ask" && nextAttempt.resumed) {
        resumableAttemptIdRef.current = nextAttempt.id;
        setResumeChoiceOpen(true);
        return;
      }
      if (mode === "restart") {
        const previousAttemptId = resumableAttemptIdRef.current;
        if (previousAttemptId) await deleteAttemptCache(previousAttemptId);
        answerRecordsRef.current = {};
        timingRecordsRef.current = {};
        pendingAnswersRef.current = {};
        pendingTimingsRef.current = {};
        setAnswers({});
        setFlags([]);
        setActiveQuestionId(null);
        setSegmentedStartQuestionId(null);
      }
      resumableAttemptIdRef.current = null;
      setResumeChoiceOpen(false);
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
        if (
          (serverAnswers[item.questionId]?.clientSequence ?? -1) <
          item.clientSequence
        ) {
          serverAnswers[item.questionId] = item;
          pendingAnswersRef.current[item.questionId] = item;
        }
      }
      for (const item of Object.values(local?.timings ?? {})) {
        if (
          (serverTimings[item.questionId]?.clientSequence ?? -1) <
          item.clientSequence
        ) {
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
      const hasListening = payload.sections.some(
        (section) => section.kind === "LISTENING",
      );
      if (!hasListening || nextAttempt.currentSection === "READING") {
        setStage("reading");
        return;
      }
      if (hasSegmentedListening(payload)) {
        setSegmentedStartQuestionId(nextAttempt.currentQuestionId);
        setStage("listening");
        return;
      }
      if (!payload.test.fullListeningAudio) {
        throw new Error("Đề Listening chưa được gắn audio cho từng câu/group");
      }
      if (
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
      setError(
        reason instanceof Error ? reason.message : "Không thể bắt đầu bài thi",
      );
      setStage("ready");
    } finally {
      setStarting(false);
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
    if (!answersToSend.length && !timingsToSend.length)
      return Promise.resolve();
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
          if (
            pendingAnswersRef.current[sent.questionId]?.clientSequence ===
            sent.clientSequence
          ) {
            delete pendingAnswersRef.current[sent.questionId];
          }
        }
        for (const sent of timingsToSend) {
          if (
            pendingTimingsRef.current[sent.questionId]?.clientSequence ===
            sent.clientSequence
          ) {
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
        isCorrect: null,
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
        isCorrect: previous?.isCorrect ?? null,
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

  const startTiming = useCallback(
    (questionId: string | null, countVisit = true) => {
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
    },
    [],
  );

  useEffect(() => {
    stopTiming();
    if (stage === "listening" || stage === "reading")
      startTiming(activeQuestionId);
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
        body: JSON.stringify({
          currentSection: section,
          currentQuestionId: questionId,
        }),
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
            if (
              payload.sections.some((section) => section.kind === "READING")
            ) {
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
          audioTestPlaying={audioTestPlaying}
          error={error}
          starting={starting}
          onAudioTest={playAudioTest}
          onStart={() => void startOrResume("ask")}
        />
      )}
      {stage === "listening" && (
        hasSegmentedListening(payload) ? (
          <SegmentedListeningPlayer
            payload={payload}
            remainingMs={remainingMs}
            answers={answers}
            setAnswer={setAnswer}
            onActiveQuestion={onListeningActive}
            initialQuestionId={segmentedStartQuestionId}
            onComplete={() => {
              if (
                payload.sections.some(
                  (section) => section.kind === "READING",
                )
              ) {
                setStage("reading");
                saveProgress("READING", null);
              } else {
                void submitAttempt();
              }
            }}
          />
        ) : (
          <ListeningPlayer
            payload={payload}
            positionMs={positionMs}
            remainingMs={remainingMs}
            answers={answers}
            setAnswer={setAnswer}
            onActiveQuestion={onListeningActive}
          />
        )
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
      {resumeChoiceOpen && (
        <ResumeAttemptDialog
          busy={starting}
          onContinue={() => void startOrResume("continue")}
          onRestart={() => void startOrResume("restart")}
          onClose={() => setResumeChoiceOpen(false)}
        />
      )}
    </main>
  );
}

function StartScreen({
  payload,
  cached,
  audioTestPlaying,
  error,
  starting,
  onAudioTest,
  onStart,
}: {
  payload: CandidatePayload;
  cached: boolean;
  audioTestPlaying: boolean;
  error: string | null;
  starting: boolean;
  onAudioTest: () => void;
  onStart: () => void;
}) {
  const hasListening = payload.sections.some(
    (section) => section.kind === "LISTENING",
  );
  const questionCount = countQuestions(payload);
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#e6f2ff_0%,#f3f6fa_45%,#e7ebf0_100%)] p-4 sm:p-8">
      <section className="mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-2xl shadow-blue-950/15">
        <header className="bg-[#061b3a] px-6 py-7 text-white sm:px-9">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-300">
            Before you begin
          </p>
          <h1 className="mt-3 text-2xl font-black sm:text-3xl">
            {payload.test.title}
          </h1>
          <p className="mt-2 text-sm text-blue-100/75">
            Hãy chuẩn bị không gian yên tĩnh và kiểm tra thiết bị trước khi bắt
            đầu.
          </p>
        </header>

        <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[1fr_0.82fr]">
          <div>
            <div className="grid grid-cols-3 gap-3">
              <StartMetric value={String(questionCount)} label="Câu hỏi" />
              <StartMetric
                value={`${payload.test.durationMinutes}'`}
                label="Thời lượng"
              />
              <StartMetric
                value={payload.test.type === "FULL_TEST" ? "Full" : "Mini"}
                label="Loại bài"
              />
            </div>
            <h2 className="mt-7 text-lg font-extrabold text-[#0b315e]">
              Hướng dẫn làm bài
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <InstructionItem>
                Đáp án được lưu tự động; reload không làm mới thời gian.
              </InstructionItem>
              {hasListening && (
                <InstructionItem>
                  Listening tự chạy theo audio và tự chuyển nội dung.
                </InstructionItem>
              )}
              <InstructionItem>
                Reading cho phép chuyển trang, xem danh mục và đánh dấu câu.
              </InstructionItem>
              <InstructionItem>
                Hết thời gian, hệ thống sẽ tự động nộp bài.
              </InstructionItem>
            </ul>
            {hasListening && (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-800">
                Listening trong chế độ thi thử không thể pause, tua hoặc nghe
                lại.
              </div>
            )}
          </div>

          <aside className="rounded-2xl border border-blue-100 bg-[#f7faff] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-100 text-[#0b5fa5]">
                <HeadphoneIcon />
              </span>
              <div>
                <h2 className="font-extrabold text-[#0b315e]">
                  Kiểm tra tai nghe
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Âm thanh sẽ di chuyển từ tai trái sang tai phải.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onAudioTest}
              disabled={audioTestPlaying}
              className="mt-5 w-full rounded-xl border border-[#1677c8] bg-white px-4 py-3 text-sm font-extrabold text-[#0b5fa5] transition hover:bg-blue-50 disabled:cursor-wait disabled:opacity-60"
            >
              {audioTestPlaying
                ? "Đang phát âm thanh…"
                : "▶ Phát âm thanh kiểm tra"}
            </button>
            <div className="mt-5 space-y-2 border-t border-blue-100 pt-5 text-xs text-slate-500">
              <p>✓ Candidate snapshot: {cached ? "đã cache" : "đã xác minh"}</p>
              <p>✓ Autosave và khôi phục lượt thi đã sẵn sàng</p>
            </div>
            {error && (
              <p className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {error}
              </p>
            )}
            <button
              onClick={onStart}
              disabled={audioTestPlaying || starting}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-[#0b4f8a] to-[#1677c8] px-5 py-4 font-extrabold text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
            >
              {starting ? "Đang kiểm tra lượt thi…" : "Bắt đầu bài thi"}
            </button>
            <Link
              href="/tests"
              className="mt-4 block text-center text-sm font-semibold text-slate-500 hover:text-[#0b5fa5]"
            >
              ← Quay lại danh sách
            </Link>
          </aside>
        </div>
      </section>
    </div>
  );
}

function ResumeAttemptDialog({
  busy,
  onContinue,
  onRestart,
  onClose,
}: {
  busy: boolean;
  onContinue: () => void;
  onRestart: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-[#03152f]/65 p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-attempt-title"
    >
      <section className="w-full max-w-lg overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-2xl shadow-slate-950/30">
        <header className="bg-[#061f47] px-6 py-5 text-white">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-300">
            Lượt thi chưa hoàn thành
          </p>
          <h2 id="resume-attempt-title" className="mt-2 text-2xl font-black">
            Bạn muốn tiếp tục hay làm lại?
          </h2>
        </header>
        <div className="p-6">
          <p className="text-sm leading-6 text-slate-600">
            Hệ thống tìm thấy một lượt thi đang làm dở. Bạn có thể tiếp tục với
            thời gian và đáp án hiện tại, hoặc hủy lượt đó để bắt đầu lại từ câu
            đầu tiên.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onContinue}
              disabled={busy}
              className="rounded-xl bg-[#1677c8] px-5 py-4 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#0f65ab] disabled:cursor-wait disabled:opacity-60"
            >
              Tiếp tục lượt thi
            </button>
            <button
              type="button"
              onClick={onRestart}
              disabled={busy}
              className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-extrabold text-red-700 transition hover:bg-red-100 disabled:cursor-wait disabled:opacity-60"
            >
              Làm lại từ đầu
            </button>
          </div>
          <p className="mt-4 text-xs leading-5 text-red-600">
            Làm lại từ đầu sẽ hủy lượt thi cũ và không thể khôi phục đáp án của
            lượt đó.
          </p>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="mt-5 w-full text-center text-sm font-semibold text-slate-500 hover:text-[#0b5fa5] disabled:opacity-50"
          >
            Để sau
          </button>
        </div>
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
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const result = attempt.result ?? legacyAttemptResult(payload, attempt);
  const hasConvertedScore =
    result.score.hasConversion && result.score.totalScaled !== null;
  const scoreValue = hasConvertedScore
    ? (result.score.totalScaled ?? 0)
    : result.correctCount * 5;
  const convertedMaximum =
    (result.score.listening.total > 0 ? 495 : 0) +
    (result.score.reading.total > 0 ? 495 : 0);
  const scoreMaximum = hasConvertedScore
    ? convertedMaximum
    : result.questionCount * 5;

  async function startRetry() {
    setRetrying(true);
    setRetryError(null);
    try {
      const response = await apiFetch(`/attempts/${attempt.id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxQuestions: 100 }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const session = (await response.json()) as { id: string };
      window.location.href = `/practice/${session.id}`;
    } catch (reason) {
      setRetryError(
        reason instanceof Error
          ? reason.message
          : "Không tạo được bài luyện lại",
      );
      setRetrying(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#eef4fb] text-slate-800">
      <section className="flex min-h-screen w-full flex-col">
        <header className="grid h-16 grid-cols-[44px_1fr_44px] items-center bg-[#031f48] px-4 text-white shadow-md">
          <Link
            href="/tests"
            aria-label="Quay lại danh sách đề"
            className="grid size-8 place-items-center rounded-full border border-white/70 text-lg transition-colors hover:bg-white/10"
          >
            ←
          </Link>
          <h1 className="text-center text-lg font-bold">Kết quả bài thi</h1>
        </header>

        <main className="flex-1 bg-[radial-gradient(circle_at_top,#ffffff_0%,#f3f7fc_52%,#e8f0f9_100%)] px-4 py-8 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-600">
                {attempt.status === "AUTO_SUBMITTED"
                  ? "Hết giờ · Đã tự động nộp bài"
                  : "Đã hoàn thành bài thi"}
              </p>
              <h2 className="mt-2 text-2xl font-black text-[#082c59] sm:text-3xl">
                {payload.test.title}
              </h2>
            </div>

            <section className="mx-auto mt-7 max-w-2xl rounded-2xl border border-blue-200 bg-white px-6 py-6 shadow-[0_18px_60px_rgba(18,73,126,0.12)] sm:px-10">
              <p className="text-center text-sm font-bold text-slate-500">
                {hasConvertedScore
                  ? "Điểm TOEIC quy đổi"
                  : "Điểm TOEIC ước tính"}
              </p>
              <p className="mt-1 text-center text-5xl font-black text-[#075fa8]">
                {scoreValue}
                <span className="ml-1 text-base font-bold text-slate-400">
                  /{scoreMaximum}
                </span>
              </p>
              <ScoreRail
                score={scoreValue}
                minimum={0}
                maximum={scoreMaximum}
                color="#1677c8"
              />
              <p className="mt-5 text-center text-xs leading-5 text-slate-500">
                {hasConvertedScore
                  ? `Dùng bảng quy đổi “${result.score.profile?.name ?? "đã cấu hình"}”. Đây là điểm tham khảo, không phải chứng chỉ TOEIC chính thức.`
                  : "Điểm ước tính = số câu đúng × 5. Đây là điểm luyện tập, không phải bảng quy đổi TOEIC chính thức."}
              </p>
            </section>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryMetric
                label="Đúng"
                value={result.correctCount}
                tone="text-emerald-600"
              />
              <SummaryMetric
                label="Sai"
                value={result.wrongCount}
                tone="text-rose-600"
              />
              <SummaryMetric
                label="Bỏ trống"
                value={result.unansweredCount}
                tone="text-amber-600"
              />
              <SummaryMetric
                label="Thời gian làm"
                value={formatClock(result.durationMs)}
                tone="text-[#075fa8]"
              />
            </div>

            <div
              className={`mt-5 grid gap-5 ${result.score.listening.total > 0 && result.score.reading.total > 0 ? "md:grid-cols-2" : "mx-auto max-w-2xl"}`}
            >
              {result.score.listening.total > 0 && (
                <ResultSectionCard
                  title="Listening"
                  section={result.score.listening}
                  accent="#1677c8"
                  tint="#dceeff"
                  estimated={!hasConvertedScore}
                />
              )}
              {result.score.reading.total > 0 && (
                <ResultSectionCard
                  title="Reading"
                  section={result.score.reading}
                  accent="#526dcc"
                  tint="#e9efff"
                  estimated={!hasConvertedScore}
                />
              )}
            </div>

            {result.parts.length > 0 && <PartAnalytics parts={result.parts} />}

            <section className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
              <SummaryMetric
                label="Thời gian active"
                value={formatClock(result.analytics.totalActiveTimeMs)}
                compact
              />
              <SummaryMetric
                label="Câu làm quá lâu"
                value={result.analytics.tooLongCount}
                compact
              />
              <SummaryMetric
                label="Lượt quay lại"
                value={result.analytics.revisitCount}
                compact
              />
              <SummaryMetric
                label="Câu cuối bỏ trống"
                value={result.analytics.finalUnansweredCount}
                compact
              />
            </section>
            {retryError && (
              <p className="mt-4 rounded-xl bg-red-50 p-4 text-center text-sm font-bold text-red-700">
                {retryError}
              </p>
            )}
          </div>
        </main>

        <footer className="flex min-h-16 flex-wrap items-center justify-center gap-2 border-t border-slate-200 bg-[#f3f4f6] px-4 py-3">
          <Link
            href="/tests"
            className="rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            Về danh sách đề
          </Link>
          <Link
            href={`/review/${attempt.id}`}
            className="rounded-md bg-[#07579a] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#064a82]"
          >
            Xem lại đáp án
          </Link>
          {result.wrongCount > 0 && (
            <button
              onClick={() => void startRetry()}
              disabled={retrying}
              className="rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {retrying
                ? "Đang tạo…"
                : `Luyện lại ${result.wrongCount} câu sai`}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}

function ResultSectionCard({
  title,
  section,
  accent,
  tint,
  estimated,
}: {
  title: string;
  section: { correct: number; total: number; scaled: number | null };
  accent: string;
  tint: string;
  estimated: boolean;
}) {
  const percentage =
    section.total > 0 ? Math.round((section.correct / section.total) * 100) : 0;
  const displayScore = section.scaled ?? section.correct * 5;
  const displayMaximum = section.scaled !== null ? 495 : section.total * 5;
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
        <span className="text-xs text-slate-500">
          {section.correct}/{section.total} câu đúng
        </span>
      </header>
      <div className="px-6 py-5">
        <p className="text-center text-sm font-semibold text-slate-500">
          {estimated ? "Điểm TOEIC ước tính" : "Điểm TOEIC quy đổi"}
        </p>
        <p
          className="mt-1 text-center text-3xl font-black"
          style={{ color: accent }}
        >
          {displayScore}
          <span className="ml-1 text-sm text-slate-400">
            /{displayMaximum}
          </span>
        </p>
        <ScoreRail
          score={displayScore}
          minimum={0}
          maximum={displayMaximum}
          color={accent}
        />
        <div className="mt-5 rounded-md bg-slate-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Hiệu suất · {percentage}%
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

function SummaryMetric({
  label,
  value,
  tone = "text-[#0b315e]",
  compact = false,
}: {
  label: string;
  value: number | string;
  tone?: string;
  compact?: boolean;
}) {
  return (
    <article
      className={
        compact
          ? "rounded-xl bg-slate-50 px-4 py-3"
          : "rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
      }
    >
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 font-black ${compact ? "text-xl" : "text-2xl"} ${tone}`}
      >
        {value}
      </p>
    </article>
  );
}

function PartAnalytics({ parts }: { parts: AttemptPartResult[] }) {
  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 bg-[#082c59] px-5 py-4 text-white">
        <h3 className="font-extrabold">Kết quả theo từng Part</h3>
        <p className="mt-1 text-xs text-blue-100">
          Thời gian chỉ tính lúc tab đang mở và câu hỏi đang active.
        </p>
      </header>
      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {parts.map((part) => {
          const percentage =
            part.total > 0 ? Math.round((part.correct / part.total) * 100) : 0;
          return (
            <article
              key={part.part}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-[#075fa8]">
                    {partLabel(part.part)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {part.correct}/{part.total} đúng · {part.unanswered} bỏ
                    trống
                  </p>
                </div>
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-black text-[#075fa8]">
                  {percentage}%
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#1677c8] to-[#55a7e8]"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <PartMetric
                  label="Tổng thời gian"
                  value={formatClock(part.activeTimeMs)}
                />
                <PartMetric
                  label="TB mỗi câu"
                  value={formatCompactTime(part.averageTimeMs)}
                />
                <PartMetric
                  label={`Quá ${Math.round(part.thresholdMs / 1000)} giây`}
                  value={`${part.tooLongCount} câu`}
                />
                <PartMetric
                  label="Quay lại"
                  value={`${part.revisitCount} lượt`}
                />
              </dl>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-slate-200 pt-3 text-[11px] text-slate-500">
                <span>
                  Nhanh + đúng:{" "}
                  <b className="text-emerald-600">
                    {part.performance.fastCorrect}
                  </b>
                </span>
                <span>
                  Nhanh + sai:{" "}
                  <b className="text-rose-500">{part.performance.fastWrong}</b>
                </span>
                <span>
                  Chậm + đúng:{" "}
                  <b className="text-emerald-600">
                    {part.performance.slowCorrect}
                  </b>
                </span>
                <span>
                  Chậm + sai:{" "}
                  <b className="text-rose-500">{part.performance.slowWrong}</b>
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PartMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-bold text-slate-700">{value}</dd>
    </div>
  );
}

function partLabel(part: AttemptPartResult["part"]) {
  return `Part ${part.replace("PART_", "")}`;
}

function formatCompactTime(milliseconds: number) {
  if (milliseconds < 60_000) return `${Math.round(milliseconds / 1000)} giây`;
  const minutes = Math.floor(milliseconds / 60_000);
  const seconds = Math.round((milliseconds % 60_000) / 1000);
  return `${minutes}p ${seconds}s`;
}

function legacyAttemptResult(
  payload: CandidatePayload,
  attempt: CandidateAttempt,
): AttemptResult {
  const listeningTotal = payload.sections
    .filter((section) => section.kind === "LISTENING")
    .flatMap((section) => section.questionGroups)
    .flatMap((group) => group.questions).length;
  const readingTotal = payload.sections
    .filter((section) => section.kind === "READING")
    .flatMap((section) => section.questionGroups)
    .flatMap((group) => group.questions).length;
  const answeredCount = attempt.answers.filter(
    (answer) => answer.selectedOptionId !== null,
  ).length;
  const correctCount =
    (attempt.listeningCorrect ?? 0) + (attempt.readingCorrect ?? 0);
  const hasConversion = attempt.totalScore !== null;
  return {
    schemaVersion: 1,
    questionCount: listeningTotal + readingTotal,
    answeredCount,
    unansweredCount: listeningTotal + readingTotal - answeredCount,
    correctCount,
    wrongCount: Math.max(0, answeredCount - correctCount),
    durationMs: Math.max(
      0,
      new Date(attempt.submittedAt ?? attempt.expiresAt).getTime() -
        new Date(attempt.startedAt).getTime(),
    ),
    score: {
      hasConversion,
      profile: null,
      listening: {
        correct: attempt.listeningCorrect ?? 0,
        total: listeningTotal,
        scaled: hasConversion ? attempt.listeningScore : null,
      },
      reading: {
        correct: attempt.readingCorrect ?? 0,
        total: readingTotal,
        scaled: hasConversion ? attempt.readingScore : null,
      },
      totalScaled: hasConversion ? attempt.totalScore : null,
    },
    analytics: {
      totalActiveTimeMs: attempt.timings.reduce(
        (sum, timing) => sum + timing.activeTimeMs,
        0,
      ),
      tooLongCount: 0,
      finalUnansweredCount: 0,
      revisitCount: attempt.timings.reduce(
        (sum, timing) => sum + Math.max(0, timing.visitCount - 1),
        0,
      ),
      revisitedQuestionCount: attempt.timings.filter(
        (timing) => timing.visitCount > 1,
      ).length,
    },
    parts: [],
  };
}

function SegmentedListeningPlayer({
  payload,
  remainingMs,
  answers,
  setAnswer,
  onActiveQuestion,
  initialQuestionId,
  onComplete,
}: {
  payload: CandidatePayload;
  remainingMs: number;
  answers: Record<string, string>;
  setAnswer: (questionId: string, optionId: string) => void;
  onActiveQuestion: (questionId: string | null) => void;
  initialQuestionId: string | null;
  onComplete: () => void;
}) {
  const steps = useMemo(
    () => buildSegmentedListeningSteps(payload),
    [payload],
  );
  const [stepIndex, setStepIndex] = useState(() =>
    segmentedStartIndex(steps, initialQuestionId),
  );
  const [playBlocked, setPlayBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const step = steps[stepIndex];
  const group = step?.type === "GROUP" ? step.group : null;
  const questions = useMemo(() => group?.questions ?? [], [group]);
  const shortcutQuestion = questions[0];
  const totalQuestionCount = countQuestions(payload);
  const answeredCount = Object.keys(answers).length;
  const visibleStimuli =
    group?.stimuli.filter((stimulus) => stimulus.type !== "AUDIO") ?? [];

  const advance = useCallback(() => {
    setPlayBlocked(false);
    if (stepIndex >= steps.length - 1) {
      onComplete();
      return;
    }
    setStepIndex(stepIndex + 1);
  }, [onComplete, stepIndex, steps.length]);

  const playCurrent = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      setPlayBlocked(false);
      await audio.play();
    } catch {
      setPlayBlocked(true);
    }
  }, []);

  useEffect(() => {
    const questionId = questions[0]?.id ?? null;
    onActiveQuestion(questionId);
  }, [onActiveQuestion, questions]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isShortcutBlocked(event) || step?.type !== "GROUP") return;
      if (event.code === "Space") {
        event.preventDefault();
        return;
      }
      const optionIndex = answerShortcutIndex(event.key);
      if (optionIndex === null) return;
      const option = shortcutQuestion?.options[optionIndex];
      if (!shortcutQuestion || !option) return;
      event.preventDefault();
      setAnswer(shortcutQuestion.id, option.id);
      onActiveQuestion(shortcutQuestion.id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onActiveQuestion, setAnswer, shortcutQuestion, step?.type]);

  if (!step) {
    return <ExamMessage title="Đề Listening không có audio từng câu/group" />;
  }

  const directionScreen =
    step.type === "INTRO" ||
    step.type === "DIRECTION" ||
    step.type === "EXAMPLE";

  return (
    <ExamShell
      title={
        directionScreen
          ? "Playing directions..."
          : `Listening: ${step.section.part?.replace("PART_", "Part ") ?? "Listening"}`
      }
      progress={`${answeredCount}/${totalQuestionCount}`}
      timer={formatClock(remainingMs)}
    >
      {step.audio && (
        <audio
          key={step.key}
          ref={audioRef}
          src={step.audio.url}
          preload="auto"
          onCanPlay={() => void playCurrent()}
          onEnded={advance}
          onError={() => setPlayBlocked(true)}
          className="hidden"
        />
      )}

      {directionScreen ? (
        <div className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col bg-[#f4f6f8]">
          <div className="exam-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-8 sm:py-10">
            <section className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-200 bg-white px-7 py-10 shadow-xl shadow-slate-950/10 sm:px-12 sm:py-14">
              <p className="text-center text-xs font-black uppercase tracking-[0.24em] text-sky-600">
                {step.type === "INTRO"
                  ? "Listening directions"
                  : step.type === "EXAMPLE"
                    ? "Example"
                    : "Directions"}
              </p>
              <h2 className="mt-5 text-center text-3xl font-black text-[#123f70] sm:text-4xl">
                {step.type === "INTRO"
                  ? "LISTENING TEST"
                  : step.type === "EXAMPLE"
                    ? `${step.section.part?.replace("PART_", "PART ")} · EXAMPLE`
                    : step.section.part?.replace("PART_", "PART ")}
              </h2>
              <div className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-slate-700 sm:text-xl sm:leading-9">
                {step.type === "INTRO" ? (
                  <p>{LISTENING_INTRO}</p>
                ) : step.type === "EXAMPLE" &&
                  step.section.direction?.exampleHtml ? (
                  <SafeHtml html={step.section.direction.exampleHtml} />
                ) : (
                  <>
                    <p>
                      <strong>Directions: </strong>
                      {candidateDirection(step.section)}
                    </p>
                    {step.type === "DIRECTION" &&
                      step.section.part === "PART_1" && <PartOneExample />}
                  </>
                )}
              </div>
            </section>
          </div>
          <footer className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 shadow-[0_-8px_24px_rgb(15_23_42/8%)] sm:py-4">
            <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-center text-xs font-medium text-slate-500 sm:text-left sm:text-sm">
                {step.audio
                  ? playBlocked
                    ? "Trình duyệt đang chặn phát tự động. Hãy phát hướng dẫn để tiếp tục."
                    : "Audio hướng dẫn đang phát và sẽ tự chuyển khi kết thúc."
                  : "Phần này không có audio hướng dẫn."}
              </p>
              {step.audio ? (
                <button
                  type="button"
                  onClick={playBlocked ? () => void playCurrent() : advance}
                  className="shrink-0 rounded-xl border border-[#123f70]/30 bg-[#123f70] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0c315a]"
                >
                  {playBlocked ? "Phát hướng dẫn" : "Bỏ qua hướng dẫn"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={advance}
                  className="shrink-0 rounded-xl bg-[#1677c8] px-7 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0f65ab]"
                >
                  {step.type === "INTRO"
                    ? "Tiếp tục"
                    : step.type === "EXAMPLE"
                      ? "Bắt đầu"
                      : `Bắt đầu ${step.section.part?.replace("PART_", "Part ")}`}
                </button>
              )}
            </div>
          </footer>
        </div>
      ) : group ? (
        <ListeningQuestionLayout
          section={step.section}
          stimuli={visibleStimuli}
          questions={questions}
          answers={answers}
          setAnswer={setAnswer}
          onActivate={onActiveQuestion}
          playBlocked={playBlocked}
          onPlay={() => void playCurrent()}
        />
      ) : null}
    </ExamShell>
  );
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
  const questions = targetQuestion
    ? [targetQuestion]
    : (group?.questions ?? []);
  const shortcutQuestion = targetQuestion ?? group?.questions[0];
  const activeTimelineQuestionId =
    targetQuestion?.id ?? questions[0]?.id ?? null;
  const isDirection = timeline.event?.type === "DIRECTION";
  const isExample = timeline.event?.type === "EXAMPLE";
  const showsListeningDirections = payload.test.type === "FULL_TEST";
  const firstDirectionId = payload.timeline
    .filter((event) => event.type === "DIRECTION")
    .sort((left, right) => left.startMs - right.startMs)[0]?.id;
  const isListeningIntro =
    showsListeningDirections &&
    isDirection &&
    timeline.event?.id === firstDirectionId;
  const totalQuestionCount = countQuestions(payload);
  const answeredCount = Object.keys(answers).length;
  const visibleStimuli =
    group?.stimuli.filter((stimulus) => stimulus.type !== "AUDIO") ?? [];

  useEffect(() => {
    onActiveQuestion(activeTimelineQuestionId);
  }, [activeTimelineQuestionId, onActiveQuestion]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isShortcutBlocked(event)) return;
      if (event.code === "Space") {
        event.preventDefault();
        return;
      }
      const optionIndex = answerShortcutIndex(event.key);
      if (optionIndex === null || isDirection || isExample) return;
      const option = shortcutQuestion?.options[optionIndex];
      if (!shortcutQuestion || !option) return;
      event.preventDefault();
      setAnswer(shortcutQuestion.id, option.id);
      onActiveQuestion(shortcutQuestion.id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDirection, isExample, onActiveQuestion, setAnswer, shortcutQuestion]);

  return (
    <ExamShell
      title={`Listening: ${section?.part?.replace("PART_", "Part ") ?? "Listening"}`}
      progress={`${answeredCount}/${totalQuestionCount}`}
      timer={formatClock(remainingMs)}
    >
      {showsListeningDirections && (isDirection || isExample) ? (
        <div className="exam-scrollbar grid h-[calc(100dvh-4rem)] overflow-y-auto place-items-center bg-[#f2f3f5] p-5">
          <section className="w-full max-w-5xl rounded-sm border border-slate-300 bg-white p-6 shadow-sm">
            <div className="mx-auto max-w-3xl py-10 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-[#07579a]">
                {isExample
                  ? "Example"
                  : isListeningIntro
                    ? "Listening directions"
                    : "Directions"}
              </p>
              <h2 className="mt-5 text-3xl font-bold text-[#123f70]">
                {isListeningIntro
                  ? "LISTENING TEST"
                  : section?.part?.replace("PART_", "Part ")}
              </h2>
              <div className="mt-5 space-y-5 text-lg leading-8 text-slate-700">
                {isListeningIntro && <p>{LISTENING_INTRO}</p>}
                <p>
                  <strong>Directions: </strong>
                  {candidateDirection(section)}
                </p>
                {section?.part === "PART_1" && <PartOneExample />}
              </div>
              {isExample && section?.direction?.exampleHtml && (
                <SafeHtml html={section.direction.exampleHtml} />
              )}
            </div>
          </section>
        </div>
      ) : group && section ? (
        <ListeningQuestionLayout
          section={section}
          stimuli={visibleStimuli}
          questions={questions}
          answers={answers}
          setAnswer={setAnswer}
          onActivate={onActiveQuestion}
        />
      ) : (
        <div className="grid h-[calc(100dvh-4rem)] place-items-center bg-[#f2f3f5] text-slate-500">
          Đang chuyển sang nội dung tiếp theo…
        </div>
      )}
    </ExamShell>
  );
}

function ListeningQuestionLayout({
  section,
  stimuli,
  questions,
  answers,
  setAnswer,
  onActivate,
  playBlocked = false,
  onPlay,
}: {
  section: CandidateSection;
  stimuli: CandidateStimulus[];
  questions: CandidateQuestion[];
  answers: Record<string, string>;
  setAnswer: (questionId: string, optionId: string) => void;
  onActivate: (questionId: string | null) => void;
  playBlocked?: boolean;
  onPlay?: () => void;
}) {
  return (
    <div className="grid h-[calc(100dvh-4rem)] min-h-0 grid-cols-1 grid-rows-2 gap-3 bg-[#f2f3f5] p-3 md:grid-cols-2 md:grid-rows-1 md:gap-5 md:px-5 md:py-4">
      <section className="exam-scrollbar min-h-0 overflow-y-auto border border-[#d7dde6] bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/4%)] sm:p-6">
        <h2 className="sticky -top-5 z-10 -mx-5 -mt-5 mb-6 border-b border-slate-200 bg-white/95 px-5 py-4 text-[17px] font-semibold leading-7 text-[#124b78] backdrop-blur-sm sm:-top-6 sm:-mx-6 sm:-mt-6 sm:px-6">
          {listeningQuestionInstruction(section.part)}
        </h2>

        <div className="space-y-7">
          {stimuli.map((stimulus) => (
            <div key={stimulus.id}>
              <Stimulus stimulus={stimulus} />
            </div>
          ))}
        </div>

        {stimuli.length === 0 && section.part === "PART_1" && (
          <div className="grid min-h-64 place-items-center border border-dashed border-amber-300 bg-amber-50 p-5 text-center text-amber-700">
            Part 1 image is unavailable.
          </div>
        )}
        {stimuli.length === 0 &&
          section.part !== "PART_1" &&
          section.part !== "PART_2" && (
            <div className="grid min-h-64 place-items-center bg-slate-50 p-5 text-center text-slate-500">
              <p>Listen to the audio and select the best answer.</p>
            </div>
          )}
        {playBlocked && onPlay && (
          <button
            type="button"
            onClick={onPlay}
            className="mt-6 rounded-lg bg-[#1677c8] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0f65ab]"
          >
            Phát audio câu hỏi
          </button>
        )}
      </section>

      <section className="exam-scrollbar min-h-0 overflow-y-auto border border-[#d7dde6] bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
        <h2 className="sticky -top-5 z-10 -mx-5 -mt-5 mb-6 border-b border-slate-200 bg-white/95 px-5 py-4 text-lg font-semibold text-[#124b78] backdrop-blur-sm">
          Question
        </h2>
        <QuestionList
          questions={questions}
          answers={answers}
          setAnswer={setAnswer}
          onActivate={(questionId) => onActivate(questionId)}
          part={section.part}
        />
      </section>
    </div>
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
              ? group.questions.map((question) => ({
                  section,
                  group,
                  questions: [question],
                }))
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
  const [catalogMode, setCatalogMode] = useState<"navigator" | "submit" | null>(
    null,
  );
  const fullTestDirections = payload.test.type === "FULL_TEST";
  const [directionStage, setDirectionStage] = useState<"INTRO" | string | null>(
    fullTestDirections && !initialQuestionId ? "INTRO" : null,
  );
  const seenDirectionIds = useRef(
    new Set(
      initialQuestionId && pages[initialPageIndex]?.section.id
        ? [pages[initialPageIndex].section.id]
        : [],
    ),
  );
  const pendingPage = useRef<{ index: number; questionId?: string } | null>(
    null,
  );
  const lastQuestionNumber = Math.max(
    payload.test.totalQuestions,
    ...pages.flatMap((item) =>
      item.questions.map((question) => question.number),
    ),
  );
  const totalQuestionCount = countQuestions(payload);
  const answeredCount = Object.keys(answers).length;
  const page = pages[pageIndex];
  const activeQuestion =
    page?.questions.find((question) => question.id === activeQuestionId) ??
    page?.questions[0];
  const applyGo = useCallback(
    (index: number, questionId?: string) => {
      const next = pages[index];
      if (!next) return;
      setPageIndex(index);
      const nextQuestionId = questionId ?? next.questions[0]?.id ?? "";
      setActiveQuestionId(nextQuestionId);
      if (nextQuestionId) onActiveQuestion(nextQuestionId);
      setCatalogMode(null);
    },
    [onActiveQuestion, pages],
  );
  const go = useCallback(
    (index: number, questionId?: string) => {
      const next = pages[index];
      if (!next) return;
      if (
        fullTestDirections &&
        !seenDirectionIds.current.has(next.section.id)
      ) {
        pendingPage.current = { index, questionId };
        setDirectionStage(next.section.id);
        setCatalogMode(null);
        return;
      }
      applyGo(index, questionId);
    },
    [applyGo, fullTestDirections, pages],
  );

  const continueDirection = useCallback(() => {
    if (directionStage === "INTRO") {
      setDirectionStage(page?.section.id ?? null);
      return;
    }
    if (directionStage) seenDirectionIds.current.add(directionStage);
    setDirectionStage(null);
    const pending = pendingPage.current;
    pendingPage.current = null;
    if (pending) applyGo(pending.index, pending.questionId);
  }, [applyGo, directionStage, page?.section.id]);

  useEffect(() => {
    if (!directionStage && activeQuestion?.id)
      onActiveQuestion(activeQuestion.id);
  }, [activeQuestion?.id, directionStage, onActiveQuestion]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (catalogMode || directionStage || isShortcutBlocked(event)) return;
      const optionIndex = answerShortcutIndex(event.key);
      if (optionIndex !== null) {
        const option = activeQuestion?.options[optionIndex];
        if (activeQuestion && option) {
          event.preventDefault();
          setAnswer(activeQuestion.id, option.id);
          onActiveQuestion(activeQuestion.id);
        }
        return;
      }
      if (event.key === "ArrowLeft" && pageIndex > 0) {
        event.preventDefault();
        go(pageIndex - 1);
      } else if (event.key === "ArrowRight" && pageIndex < pages.length - 1) {
        event.preventDefault();
        go(pageIndex + 1);
      } else if (event.key.toLowerCase() === "f" && activeQuestion) {
        event.preventDefault();
        toggleFlag(activeQuestion.id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeQuestion,
    catalogMode,
    directionStage,
    go,
    onActiveQuestion,
    pageIndex,
    pages.length,
    setAnswer,
    toggleFlag,
  ]);

  if (!page) return <ExamMessage title="Đề không có section Reading" />;
  const range = `${page.questions[0]?.number ?? "—"}${page.questions.length > 1 ? `–${page.questions.at(-1)?.number}` : ""}`;

  if (directionStage) {
    const directionSection =
      directionStage === "INTRO"
        ? null
        : payload.sections.find((section) => section.id === directionStage) ??
          page.section;
    return (
      <ExamShell
        title="Reading directions"
        progress={`${answeredCount}/${totalQuestionCount}`}
        timer={formatClock(remainingMs)}
      >
        <div className="exam-scrollbar grid h-[calc(100dvh-4rem)] overflow-y-auto place-items-center bg-[#f4f6f8] px-5 py-10">
          <section className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white px-7 py-10 shadow-xl shadow-slate-950/10 sm:px-12 sm:py-14">
            <p className="text-center text-xs font-black uppercase tracking-[0.24em] text-sky-600">
              Directions
            </p>
            <h2 className="mt-5 text-center text-3xl font-black text-[#123f70] sm:text-4xl">
              {directionStage === "INTRO"
                ? "READING TEST"
                : directionSection?.part?.replace("PART_", "PART ")}
            </h2>
            <div className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-slate-700 sm:text-xl sm:leading-9">
              {directionStage === "INTRO" ? (
                <p>{READING_INTRO}</p>
              ) : (
                <p>
                  <strong>Directions: </strong>
                  {candidateDirection(directionSection)}
                </p>
              )}
            </div>
            <div className="mt-9 flex justify-center">
              <button
                type="button"
                onClick={continueDirection}
                className="rounded-xl bg-[#1677c8] px-7 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0f65ab]"
              >
                {directionStage === "INTRO"
                  ? "Tiếp tục"
                  : `Bắt đầu ${directionSection?.part?.replace("PART_", "Part ")}`}
              </button>
            </div>
          </section>
        </div>
      </ExamShell>
    );
  }

  return (
    <ExamShell
      title={`Reading: Questions ${range} of ${lastQuestionNumber}`}
      progress={`${answeredCount}/${totalQuestionCount}`}
      timer={formatClock(remainingMs)}
      submit={() => setCatalogMode("submit")}
    >
      <div className="grid h-[calc(100vh-120px)] grid-cols-1 grid-rows-2 gap-3 bg-[#f2f3f5] p-3 md:grid-cols-2 md:grid-rows-1 md:gap-5 md:px-5 md:py-4">
        <section className="exam-scrollbar min-h-0 overflow-y-auto border border-[#d7dde6] bg-white p-6 pb-10 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
          {page.section.part === "PART_5" ? (
            <p className="text-lg font-semibold leading-8 text-[#124b78]">
              {page.section.direction?.text ??
                "Select the best answer to complete the sentence."}
            </p>
          ) : page.group.stimuli.length ? (
            page.group.stimuli.map((stimulus, index) => (
              <div key={stimulus.id} className="mb-8">
                {page.group.stimuli.length > 1 && (
                  <h2 className="mb-5 text-lg font-semibold text-[#124b78]">
                    Passage {index + 1}
                  </h2>
                )}
                <Stimulus stimulus={stimulus} />
              </div>
            ))
          ) : (
            <p className="text-amber-700">Passage chưa được gắn vào đề.</p>
          )}
        </section>
        <section className="exam-scrollbar min-h-0 overflow-y-auto border border-[#d7dde6] bg-white p-5 shadow-[0_1px_2px_rgb(15_23_42/4%)]">
          <h2 className="sticky -top-5 z-10 -mx-5 -mt-5 mb-5 border-b border-slate-200 bg-white/95 px-5 py-4 text-lg font-semibold text-[#124b78]">
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
          <span
            className={`grid size-7 place-items-center rounded-md border-2 text-sm shadow-sm transition-colors ${activeQuestion && flags.includes(activeQuestion.id) ? "border-[#1677c8] bg-[#1677c8] text-white" : "border-slate-400 bg-white group-hover:border-[#07579a]"}`}
          >
            {activeQuestion && flags.includes(activeQuestion.id) ? "✓" : ""}
          </span>
          <span>Mark item for review</span>
          <kbd className="hidden rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-500 lg:inline">
            F
          </kbd>
        </button>
        <button
          onClick={() => setCatalogMode("navigator")}
          aria-label="Question list"
          className="grid h-14 w-14 place-items-center bg-[#07579a] text-xl text-white transition-colors hover:bg-[#064a82]"
        >
          ☷
        </button>
        <div className="flex">
          <NavButton
            disabled={pageIndex === 0}
            onClick={() => go(pageIndex - 1)}
          >
            ←
          </NavButton>
          <NavButton
            disabled={pageIndex === pages.length - 1}
            onClick={() => go(pageIndex + 1)}
          >
            →
          </NavButton>
        </div>
      </footer>
      {catalogMode && (
        <QuestionCatalog
          mode={catalogMode}
          payload={payload}
          pages={pages}
          answers={answers}
          flags={flags}
          activeQuestionId={activeQuestion?.id ?? ""}
          close={() => setCatalogMode(null)}
          jump={go}
          submit={onSubmit}
          requestSubmit={() => setCatalogMode("submit")}
          submitting={submitting}
        />
      )}
    </ExamShell>
  );
}

function QuestionCatalog({
  mode,
  payload,
  pages,
  answers,
  flags,
  activeQuestionId,
  close,
  jump,
  submit,
  requestSubmit,
  submitting,
}: {
  mode: "navigator" | "submit";
  payload: CandidatePayload;
  pages: Array<{
    section: CandidateSection;
    group: CandidateGroup;
    questions: CandidateQuestion[];
  }>;
  answers: Record<string, string>;
  flags: string[];
  activeQuestionId: string;
  close: () => void;
  jump: (index: number, questionId?: string) => void;
  submit: () => void;
  requestSubmit: () => void;
  submitting: boolean;
}) {
  const allQuestions = payload.sections.flatMap((section) =>
    section.questionGroups.flatMap((group) => group.questions),
  );
  const unansweredCount = allQuestions.filter(
    (question) => !answers[question.id],
  ).length;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === "submit" ? "Xác nhận nộp bài" : "Danh mục câu hỏi"}
      className="absolute inset-0 z-40 grid place-items-center bg-slate-950/55 p-4"
    >
      <section className="exam-scrollbar max-h-[86vh] w-full max-w-xl overflow-y-auto rounded bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-bold text-[#07579a]">
              {mode === "submit" ? "Xác nhận nộp bài" : "Danh mục câu hỏi"}
            </h2>
            <p className="text-xs text-slate-500">
              {mode === "submit"
                ? "Kiểm tra tiến độ trước khi kết thúc lượt thi."
                : "Chọn số câu để chuyển trang."}
            </p>
          </div>
          <button
            onClick={close}
            className="grid size-9 place-items-center rounded-full bg-slate-100 text-xl"
          >
            ×
          </button>
        </div>
        {mode === "submit" && (
          <div
            className={`mt-5 rounded-xl border px-4 py-3 text-sm ${unansweredCount > 0 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
          >
            {unansweredCount > 0
              ? `Bạn còn ${unansweredCount} câu chưa trả lời. Bạn vẫn muốn nộp bài?`
              : "Bạn đã trả lời tất cả câu hỏi. Bài thi đã sẵn sàng để nộp."}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
          <span>
            <i className="mr-1.5 inline-block size-3 rounded-sm bg-[#07579a]" />
            Đã trả lời
          </span>
          <span>
            <i className="mr-1.5 inline-block size-3 rounded-sm border border-slate-300 bg-white" />
            Chưa trả lời
          </span>
          <span>
            <i className="mr-1.5 inline-block size-3 rounded-sm border-2 border-[#1677c8]" />
            Đã flag
          </span>
        </div>
        <div className="mt-5 space-y-5">
          {payload.sections
            .filter((section) => section.kind === "READING")
            .map((section) => (
              <div key={section.id}>
                <h3 className="mb-2 font-bold text-slate-700">
                  {section.part?.replace("PART_", "Part ")}
                </h3>
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                  {section.questionGroups
                    .flatMap((group) => group.questions)
                    .map((question) => {
                      const target = pages.findIndex((page) =>
                        page.questions.some((item) => item.id === question.id),
                      );
                      return (
                        <button
                          key={question.id}
                          onClick={() => jump(target, question.id)}
                          className={`relative aspect-square rounded border text-[11px] font-bold ${answers[question.id] ? "border-[#07579a] bg-[#07579a] text-white" : "border-slate-300"} ${activeQuestionId === question.id ? "ring-2 ring-slate-700" : ""}`}
                        >
                          {question.number}
                          {flags.includes(question.id) && (
                            <span className="absolute -right-1 -top-2 text-[#1677c8]">
                              ⚑
                            </span>
                          )}
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
            onClick={mode === "submit" ? submit : requestSubmit}
            disabled={submitting}
            className="rounded bg-[#1677c8] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#0b5fa5] disabled:opacity-60"
          >
            {submitting
              ? "Đang nộp…"
              : mode === "submit"
                ? "Nộp bài"
                : "Kết thúc bài thi"}
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
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggleFullscreen = () => {
    const action = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
    void action.catch(() => undefined);
  };

  return (
    <div className="relative h-dvh overflow-hidden">
      <header className="grid h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 bg-[#001b47] px-3 text-white shadow-sm sm:gap-4 sm:px-6">
        <div className="rounded-md bg-white px-2 py-2 text-[10px] font-black text-[#07579a] shadow-sm sm:px-3 sm:text-xs">
          PACE<span className="text-[#2493dd]">LINGO</span>
        </div>
        <h1 className="truncate text-center text-xs font-bold sm:text-lg">
          {title}
        </h1>
        <div className="flex items-center gap-2 text-xs font-bold tabular-nums">
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Thoát toàn màn hình" : "Mở toàn màn hình"}
            title={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
            className="hidden size-9 place-items-center rounded-md bg-white/10 text-white transition hover:bg-white/20 sm:grid"
          >
            <FullscreenIcon active={fullscreen} />
          </button>
          <span className="hidden min-w-[68px] rounded-md bg-white px-3 py-2 text-center text-[#07579a] shadow-sm sm:inline-block">
            {progress}
          </span>
          <span className="flex min-w-[92px] items-center justify-center gap-1.5 rounded-md bg-[#2f86d6] px-3 py-2 text-white shadow-sm">
            <ClockIcon />
            {timer}
          </span>
          {submit && (
            <button
              onClick={submit}
              className="rounded-md bg-[#1677c8] px-4 py-2 text-white shadow-sm transition-colors hover:bg-[#0b5fa5]"
            >
              Submit
            </button>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}

function PartOneExample() {
  return (
    <div className="mt-8">
      <img
        src="/directions/part-1-example.jpg"
        alt="Two women sitting at a table"
        className="mx-auto max-h-[430px] w-full max-w-2xl rounded-lg object-contain shadow-sm"
      />
      <p className="mx-auto mt-6 max-w-3xl text-left italic">
        {PART_1_EXAMPLE_TEXT}
      </p>
    </div>
  );
}

function candidateDirection(section: CandidateSection | null | undefined) {
  if (!section) return "";
  if (section.directionMode === "CUSTOM" && section.direction?.text) {
    return section.direction.text;
  }
  return partDirection(section.part);
}

function listeningQuestionInstruction(
  part: CandidateSection["part"] | undefined,
) {
  if (part === "PART_1") {
    return "Select the one statement that best describes what you see in the picture.";
  }
  if (part === "PART_2") {
    return "Select the best response to the question.";
  }
  return "Listen and select the best answer.";
}

function QuestionList({
  questions,
  answers,
  setAnswer,
  onActivate,
  part,
}: {
  questions: CandidateQuestion[];
  answers: Record<string, string>;
  setAnswer: (questionId: string, optionId: string) => void;
  onActivate?: (questionId: string) => void;
  part?: CandidateSection["part"];
}) {
  const labelOnly = part === "PART_1" || part === "PART_2";

  return (
    <div className="space-y-8">
      {questions.map((question) => (
        <article key={question.id} onClick={() => onActivate?.(question.id)}>
          <div className="flex gap-3 text-[17px] leading-7">
            <strong className="shrink-0">{question.number}.</strong>
            {labelOnly ? (
              <span>Question {question.number}</span>
            ) : (
              <SafeHtml html={question.promptHtml} compact />
            )}
          </div>
          <div className="mt-4 space-y-2.5 pl-8">
            {question.options.map((option) => (
              <label
                key={option.id}
                className={`flex cursor-pointer items-center gap-3.5 border px-4 py-3.5 text-[17px] leading-7 transition-colors ${answers[question.id] === option.id ? "border-[#2b69a9] bg-blue-50" : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/40"}`}
              >
                <input
                  type="radio"
                  name={question.id}
                  checked={answers[question.id] === option.id}
                  onChange={() => setAnswer(question.id, option.id)}
                  className="size-5 shrink-0 accent-[#07579a]"
                />
                <span>
                  <strong>({option.label})</strong>
                  {!labelOnly && (
                    <>
                      {" "}
                      <HtmlText html={option.contentHtml} />
                    </>
                  )}
                </span>
              </label>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

function Stimulus({ stimulus }: { stimulus: CandidateStimulus }) {
  if (stimulus.type === "HTML")
    return <SafeHtml html={stimulus.contentHtml ?? ""} />;
  if (stimulus.type === "IMAGE") {
    return stimulus.media ? (
      <img
        src={stimulus.media.url}
        alt={stimulus.altText ?? stimulus.media.altText ?? "TOEIC stimulus"}
        className="mx-auto max-h-[520px] max-w-full object-contain"
      />
    ) : (
      <p className="rounded bg-amber-50 p-3 text-amber-700">
        {stimulus.altText ?? "Ảnh chưa được gắn"}
      </p>
    );
  }
  return null;
}

function SafeHtml({
  html,
  compact = false,
}: {
  html: string;
  compact?: boolean;
}) {
  const textLength = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").length;
  const blocks = (
    html.match(/<(p|div|article|table|tr|li|header|section)\b/gi) ?? []
  ).length;
  const estimatedHeight = compact
    ? Math.min(
        340,
        Math.max(38, Math.ceil(textLength / 60) * 28 + blocks * 11 + 5),
      )
    : Math.min(
        5000,
        Math.max(180, Math.ceil(textLength / 55) * 28 + blocks * 18 + 70),
      );
  const fontSize = compact ? 17 : 16;
  const [height, setHeight] = useState(estimatedHeight);

  return (
    <iframe
      sandbox="allow-same-origin"
      scrolling="no"
      onLoad={(event) => {
        const frameDocument = event.currentTarget.contentDocument;
        const contentHeight = Math.max(
          frameDocument?.documentElement.scrollHeight ?? 0,
          frameDocument?.body.scrollHeight ?? 0,
        );
        if (contentHeight > 0) {
          setHeight(Math.max(estimatedHeight, contentHeight + (compact ? 4 : 20)));
        }
      }}
      srcDoc={`<!doctype html><meta charset="utf-8"><style>html,body{overflow:hidden}body{box-sizing:border-box;font:${fontSize}px/1.65 Roboto,"Segoe UI","Noto Sans",system-ui,sans-serif;margin:0;padding:0 0 ${compact ? 2 : 28}px;color:#172033}p:first-child{margin-top:0}p:last-child{margin-bottom:0}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:8px}img{max-width:100%}</style>${html}`}
      style={{ height }}
      className="block w-full border-0 bg-white"
      title="Candidate content"
    />
  );
}

function HtmlText({ html }: { html: string }) {
  return (
    <>
      {html
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()}
    </>
  );
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

function FullscreenIcon({ active }: { active: boolean }) {
  return active ? (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        d="M9 4v5H4m11-5v5h5M9 20v-5H4m11 5v-5h5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        d="M9 4H4v5m11-5h5v5M9 20H4v-5m11 5h5v-5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeadphoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <path d="M6 13H4a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2zm12 0h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2z" />
    </svg>
  );
}

function StartMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-center">
      <strong className="block text-xl font-black text-[#0b4f8a]">
        {value}
      </strong>
      <span className="mt-1 block text-[11px] font-semibold text-slate-500">
        {label}
      </span>
    </div>
  );
}

function InstructionItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-1 grid size-4 shrink-0 place-items-center rounded-full bg-blue-100 text-[10px] font-black text-[#0b5fa5]">
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

function NavButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="grid h-14 w-14 place-items-center bg-[#1677c8] text-xl font-bold text-white transition-colors hover:bg-[#0b5fa5] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-100"
    >
      {children}
    </button>
  );
}

function ExamMessage({ title, detail }: { title: string; detail?: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#e9eaec] p-5">
      <div className="rounded-2xl bg-white p-8 text-center shadow-xl">
        <h1 className="text-xl font-bold">{title}</h1>
        {detail && (
          <p className="mt-3 max-w-lg text-sm text-red-600">{detail}</p>
        )}
        <Link href="/tests" className="mt-5 block text-sm text-[#07579a]">
          ← Danh sách đề
        </Link>
      </div>
    </main>
  );
}

function findGroup(
  payload: CandidatePayload,
  groupId: string | null,
  questionId: string | null,
) {
  return payload.sections
    .flatMap((section) => section.questionGroups)
    .find(
      (group) =>
        group.id === groupId ||
        (questionId
          ? group.questions.some((question) => question.id === questionId)
          : false),
    );
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

function answerShortcutIndex(key: string) {
  const normalized = key.toLowerCase();
  const index = ["a", "b", "c", "d"].indexOf(normalized);
  if (index >= 0) return index;
  const number = Number(normalized);
  return Number.isInteger(number) && number >= 1 && number <= 4
    ? number - 1
    : null;
}

function isShortcutBlocked(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey) return true;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.isContentEditable ||
    target.closest(
      "input, textarea, select, button, a, [contenteditable='true']",
    ),
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
  const payload = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  return Array.isArray(payload?.message)
    ? payload.message.join(", ")
    : (payload?.message ?? `Request failed (${response.status})`);
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
