import type { AttemptResult, CandidateOption, CandidateStimulus } from "./candidate-types";

export interface AttemptHistoryItem {
  id: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "AUTO_SUBMITTED" | "EXPIRED" | "ABANDONED";
  startedAt: string;
  submittedAt: string | null;
  expiresAt: string;
  listeningCorrect: number | null;
  readingCorrect: number | null;
  listeningScore: number | null;
  readingScore: number | null;
  totalScore: number | null;
  result: AttemptResult | null;
  test: { id: string; title: string; description: string | null; type: string };
  testVersion: { id: string; version: number };
  _count: { answers: number };
}

export interface AttemptReview {
  attempt: {
    id: string;
    status: string;
    startedAt: string;
    submittedAt: string | null;
    result: AttemptResult | null;
  };
  test: { id: string; title: string; type: string; version: number };
  sections: ReviewSection[];
}

export interface ReviewSection {
  id: string;
  title: string;
  kind: "LISTENING" | "READING";
  part: string | null;
  order: number;
  groups: ReviewGroup[];
}

export interface ReviewGroup {
  id: string;
  type: string;
  title: string | null;
  order: number;
  stimuli: CandidateStimulus[];
  transcriptHtml: string | null;
  questions: ReviewQuestion[];
}

export interface ReviewQuestion {
  id: string;
  number: number;
  promptHtml: string;
  order: number;
  options: CandidateOption[];
  correctOptionId: string | null;
  selectedOptionId: string | null;
  isCorrect: boolean;
  isFlagged: boolean;
  activeTimeMs: number;
  visitCount: number;
  explanationHtml: string | null;
  grammarTopic: string | null;
  vocabularyTags: string[];
  difficulty: string | null;
  audioSegments: ReviewAudioSegment[];
}

export interface ReviewAudioSegment {
  id: string;
  segmentType: "ANSWER_EVIDENCE" | "CONTEXT";
  startMs: number;
  endMs: number;
  audio: {
    id: string;
    type: "AUDIO";
    url: string;
    mimeType: string;
    durationMs: number | null;
    altText: string | null;
  } | null;
}

export interface PracticeSession {
  id: string;
  sourceAttemptId: string | null;
  sourceType: string;
  mode: string;
  status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  durationMinutes: number | null;
  createdAt: string;
  completedAt: string | null;
  test: { id: string; title: string } | null;
  questions: PracticeQuestion[];
}

export interface PracticeQuestion {
  order: number;
  id: string;
  number: number;
  promptHtml: string;
  selectedOptionId: string | null;
  answeredAt: string | null;
  group: {
    id: string;
    title: string | null;
    stimuli: CandidateStimulus[];
    section: { kind: string; part: string | null; title: string };
  };
  options: Array<CandidateOption & { isCorrect?: boolean }>;
  correctOptionId?: string | null;
  isCorrect?: boolean;
  explanationHtml?: string | null;
  grammarTopic?: string | null;
  vocabularyTags?: string[];
  difficulty?: string | null;
}
