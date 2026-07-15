import type {
  CandidateGroup,
  CandidateMedia,
  CandidatePayload,
  CandidateSection,
} from "./candidate-types";

export type SegmentedListeningStep =
  | {
      key: string;
      type: "INTRO";
      section: CandidateSection;
      group: null;
      audio: CandidateMedia | null;
    }
  | {
      key: string;
      type: "DIRECTION" | "EXAMPLE";
      section: CandidateSection;
      group: null;
      audio: CandidateMedia | null;
    }
  | {
      key: string;
      type: "GROUP";
      section: CandidateSection;
      group: CandidateGroup;
      audio: CandidateMedia | null;
    };

export function buildSegmentedListeningSteps(
  payload: CandidatePayload,
): SegmentedListeningStep[] {
  const sections = payload.sections
    .filter((section) => section.kind === "LISTENING")
    .sort((left, right) => left.order - right.order);
  if (!sections.length) return [];

  const steps: SegmentedListeningStep[] = [];
  const fullTest = payload.test.type === "FULL_TEST";
  if (fullTest) {
    steps.push({
      key: "listening-intro",
      type: "INTRO",
      section: sections[0],
      group: null,
      audio: payload.test.listeningIntroAudio,
    });
  }

  for (const section of sections) {
    if (fullTest) {
      steps.push({
        key: `direction-${section.id}`,
        type: "DIRECTION",
        section,
        group: null,
        audio: section.direction?.audio ?? null,
      });
      if (section.direction?.exampleAudio) {
        steps.push({
          key: `example-${section.id}`,
          type: "EXAMPLE",
          section,
          group: null,
          audio: section.direction.exampleAudio,
        });
      }
    }

    for (const group of [...section.questionGroups].sort(
      (left, right) => left.order - right.order,
    )) {
      const audio = group.stimuli.find(
        (stimulus) => stimulus.type === "AUDIO" && stimulus.media,
      )?.media;
      steps.push({
        key: `group-${group.id}`,
        type: "GROUP",
        section,
        group,
        audio: audio ?? null,
      });
    }
  }

  return steps;
}

export function segmentedStartIndex(
  steps: SegmentedListeningStep[],
  questionId: string | null,
) {
  if (!questionId) return 0;
  const index = steps.findIndex(
    (step) =>
      step.type === "GROUP" &&
      step.group.questions.some((question) => question.id === questionId),
  );
  return Math.max(0, index);
}

export function hasSegmentedListening(payload: CandidatePayload) {
  return payload.sections.some(
    (section) =>
      section.kind === "LISTENING" &&
      section.questionGroups.some((group) =>
        group.stimuli.some(
          (stimulus) => stimulus.type === "AUDIO" && stimulus.media,
        ),
      ),
  );
}
