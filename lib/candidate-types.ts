export type CandidatePart =
  | "PART_1"
  | "PART_2"
  | "PART_3"
  | "PART_4"
  | "PART_5"
  | "PART_6"
  | "PART_7";

export interface CandidateMedia {
  id: string;
  type: "IMAGE" | "AUDIO";
  url: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  altText: string | null;
}

export interface CandidateOption {
  id: string;
  label: string;
  contentHtml: string;
  order: number;
}

export interface CandidateQuestion {
  id: string;
  number: number;
  promptHtml: string;
  order: number;
  options: CandidateOption[];
}

export interface CandidateStimulus {
  id: string;
  type: "HTML" | "IMAGE" | "AUDIO";
  contentHtml: string | null;
  altText: string | null;
  order: number;
  media: CandidateMedia | null;
}

export interface CandidateGroup {
  id: string;
  type: string;
  title: string | null;
  order: number;
  stimuli: CandidateStimulus[];
  questions: CandidateQuestion[];
}

export interface CandidateSection {
  id: string;
  title: string;
  kind: "LISTENING" | "READING";
  part: CandidatePart | null;
  order: number;
  durationMinutes: number | null;
  directionMode: "DEFAULT" | "CUSTOM" | "NONE";
  direction: {
    id: string;
    text: string;
    audio: CandidateMedia | null;
    exampleHtml: string | null;
    exampleAudio: CandidateMedia | null;
  } | null;
  questionGroups: CandidateGroup[];
}

export interface CandidateTimelineEvent {
  id: string;
  type:
    | "DIRECTION"
    | "EXAMPLE"
    | "QUESTION"
    | "QUESTION_GROUP"
    | "PART_TRANSITION"
    | "LISTENING_END";
  startMs: number;
  endMs: number;
  order: number;
  sectionId: string | null;
  groupId: string | null;
  questionId: string | null;
}

export interface CandidatePayload {
  schemaVersion: 1;
  test: {
    id: string;
    title: string;
    description: string | null;
    type: "FULL_TEST" | "MINI_TEST" | "PART_PRACTICE";
    durationMinutes: number;
    totalQuestions: number;
    fullListeningAudio: CandidateMedia | null;
    listeningIntroAudio: CandidateMedia | null;
  };
  sections: CandidateSection[];
  timeline: CandidateTimelineEvent[];
}

export interface CandidateManifest {
  test: {
    id: string;
    title: string;
    description: string | null;
    type: string;
    totalQuestions: number;
    durationMinutes: number;
  };
  testVersion: {
    id: string;
    version: number;
    schemaVersion: number;
    candidatePayloadHash: string;
  };
  candidateUrl: string;
  serverNow: string;
}

export interface CandidateRuntime extends CandidateManifest {
  runtimeToken: string;
  listeningStartedAt: string;
  expectedAudioPositionMs: number;
}

export type AttemptStatus =
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "AUTO_SUBMITTED"
  | "EXPIRED"
  | "ABANDONED";

export interface AttemptAnswer {
  questionId: string;
  selectedOptionId: string | null;
  isFlagged: boolean;
  answeredAt: string | null;
  isCorrect: boolean | null;
  clientSequence: number;
}

export interface AttemptTiming {
  questionId: string;
  activeTimeMs: number;
  visitCount: number;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  clientSequence: number;
}

export interface CandidateAttempt {
  id: string;
  testId: string;
  testVersionId: string;
  status: AttemptStatus;
  startedAt: string;
  listeningEndsAt: string | null;
  readingEndsAt: string | null;
  expiresAt: string;
  submittedAt: string | null;
  currentSection: "LISTENING" | "READING" | null;
  currentQuestionId: string | null;
  listeningCorrect: number | null;
  readingCorrect: number | null;
  listeningScore: number | null;
  readingScore: number | null;
  totalScore: number | null;
  result: AttemptResult | null;
  answers: AttemptAnswer[];
  timings: AttemptTiming[];
  serverNow: string;
  resumed?: boolean;
}

export interface AttemptResult {
  schemaVersion: 1;
  questionCount: number;
  answeredCount: number;
  unansweredCount: number;
  correctCount: number;
  wrongCount: number;
  durationMs: number;
  score: {
    hasConversion: boolean;
    profile: {
      name: string;
      source: string | null;
      version: number;
      isOfficial: boolean;
    } | null;
    listening: { correct: number; total: number; scaled: number | null };
    reading: { correct: number; total: number; scaled: number | null };
    totalScaled: number | null;
  };
  analytics: {
    totalActiveTimeMs: number;
    tooLongCount: number;
    finalUnansweredCount: number;
    revisitCount: number;
    revisitedQuestionCount: number;
  };
  parts: AttemptPartResult[];
}

export interface AttemptPartResult {
  part: CandidatePart;
  total: number;
  answered: number;
  correct: number;
  wrong: number;
  unanswered: number;
  activeTimeMs: number;
  averageTimeMs: number;
  tooLongCount: number;
  revisitCount: number;
  revisitedQuestionCount: number;
  thresholdMs: number;
  performance: {
    fastCorrect: number;
    fastWrong: number;
    slowCorrect: number;
    slowWrong: number;
  };
}

export function parseCandidatePayload(value: unknown): CandidatePayload {
  const root = record(value, "$ candidate payload");
  if (root.schemaVersion !== 1) {
    throw new Error(`Unsupported candidate schemaVersion: ${String(root.schemaVersion)}`);
  }
  const test = record(root.test, "test");
  string(test.id, "test.id");
  string(test.title, "test.title");
  positiveNumber(test.durationMinutes, "test.durationMinutes");
  nonNegativeNumber(test.totalQuestions, "test.totalQuestions");
  const sections = array(root.sections, "sections");
  const timeline = array(root.timeline, "timeline");

  for (const [sectionIndex, rawSection] of sections.entries()) {
    const section = record(rawSection, `sections.${sectionIndex}`);
    string(section.id, `sections.${sectionIndex}.id`);
    if (section.kind !== "LISTENING" && section.kind !== "READING") {
      throw new Error(`sections.${sectionIndex}.kind is invalid`);
    }
    const hidesSpokenChoices =
      section.part === "PART_1" || section.part === "PART_2";
    const groups = array(
      section.questionGroups,
      `sections.${sectionIndex}.questionGroups`,
    );
    for (const [groupIndex, rawGroup] of groups.entries()) {
      const group = record(
        rawGroup,
        `sections.${sectionIndex}.questionGroups.${groupIndex}`,
      );
      string(group.id, `group ${groupIndex}.id`);
      array(group.stimuli, `group ${groupIndex}.stimuli`);
      const questions = array(group.questions, `group ${groupIndex}.questions`);
      for (const [questionIndex, rawQuestion] of questions.entries()) {
        const question = record(rawQuestion, `question ${questionIndex}`);
        string(question.id, `question ${questionIndex}.id`);
        positiveNumber(question.number, `question ${questionIndex}.number`);
        string(question.promptHtml, `question ${questionIndex}.promptHtml`);
        const options = array(question.options, `question ${questionIndex}.options`);
        for (const rawOption of options) {
          const option = record(rawOption, "option");
          string(option.id, "option.id");
          string(option.label, "option.label");
          if (hidesSpokenChoices) {
            stringAllowEmpty(option.contentHtml, "option.contentHtml");
          } else {
            string(option.contentHtml, "option.contentHtml");
          }
          if ("isCorrect" in option) {
            throw new Error("Candidate payload exposes isCorrect");
          }
        }
      }
    }
  }

  for (const [index, rawEvent] of timeline.entries()) {
    const event = record(rawEvent, `timeline.${index}`);
    string(event.id, `timeline.${index}.id`);
    nonNegativeNumber(event.startMs, `timeline.${index}.startMs`);
    positiveNumber(event.endMs, `timeline.${index}.endMs`);
    if ((event.endMs as number) <= (event.startMs as number)) {
      throw new Error(`timeline.${index} has an invalid range`);
    }
  }

  return value as CandidatePayload;
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  return value;
}

function string(value: unknown, path: string) {
  if (typeof value !== "string" || !value) {
    throw new Error(`${path} must be a non-empty string`);
  }
}

function stringAllowEmpty(value: unknown, path: string) {
  if (typeof value !== "string") {
    throw new Error(`${path} must be a string`);
  }
}

function positiveNumber(value: unknown, path: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${path} must be a positive number`);
  }
}

function nonNegativeNumber(value: unknown, path: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${path} must be a non-negative number`);
  }
}
