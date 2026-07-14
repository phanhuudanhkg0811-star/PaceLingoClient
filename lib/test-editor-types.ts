export type MediaType = "IMAGE" | "AUDIO";
export type ToeicPart =
  "PART_1" | "PART_2" | "PART_3" | "PART_4" | "PART_5" | "PART_6" | "PART_7";

export interface MediaAsset {
  id: string;
  type: MediaType;
  url: string;
  originalName: string;
  mimeType: string;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  altText: string | null;
}

export interface Option {
  id: string;
  label: string;
  contentHtml: string;
  isCorrect: boolean;
  order: number;
}

export interface AudioSegment {
  id: string;
  audioAssetId: string;
  audioAsset: MediaAsset;
  startMs: number;
  endMs: number;
  segmentType: "ANSWER_EVIDENCE" | "CONTEXT";
}

export interface Question {
  id: string;
  number: number;
  promptHtml: string;
  explanationHtml: string | null;
  grammarTopic: string | null;
  vocabularyTags: string[];
  difficulty: "EASY" | "MEDIUM" | "HARD" | null;
  order: number;
  options: Option[];
  audioSegments: AudioSegment[];
}

export interface Stimulus {
  id: string;
  type: "HTML" | "IMAGE" | "AUDIO";
  contentHtml: string | null;
  mediaAssetId: string | null;
  mediaAsset: MediaAsset | null;
  altText: string | null;
  order: number;
}

export interface QuestionGroup {
  id: string;
  type: string;
  title: string | null;
  transcriptHtml: string | null;
  order: number;
  stimuli: Stimulus[];
  questions: Question[];
}

export interface TestSection {
  id: string;
  title: string;
  kind: "LISTENING" | "READING";
  part: ToeicPart | null;
  order: number;
  directionMode: "DEFAULT" | "CUSTOM" | "NONE";
  directionTemplate: {
    id: string;
    directionText: string;
    exampleHtml: string | null;
  } | null;
  questionGroups: QuestionGroup[];
}

export interface TimelineEvent {
  id?: string;
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

export interface TestTree {
  id: string;
  title: string;
  description: string | null;
  type: "FULL_TEST" | "MINI_TEST" | "PART_PRACTICE";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  durationMinutes: number;
  totalQuestions: number;
  fullListeningAudioId: string | null;
  fullListeningAudio: MediaAsset | null;
  sections: TestSection[];
  timelineEvents: TimelineEvent[];
  versions: Array<{
    id: string;
    version: number;
    status: string;
    publishedAt: string | null;
  }>;
}

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface TestValidation {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  stats: {
    totalQuestions: number;
    questionsByPart: Partial<Record<ToeicPart, number>>;
  };
}
