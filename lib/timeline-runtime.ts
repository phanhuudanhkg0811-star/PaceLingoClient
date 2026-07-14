import type {
  CandidatePayload,
  CandidateTimelineEvent,
} from "./candidate-types";

export interface TimelineState {
  positionMs: number;
  event: CandidateTimelineEvent | null;
  sectionId: string | null;
  groupId: string | null;
  questionId: string | null;
  listeningEnded: boolean;
}

export function deriveTimelineState(
  payload: CandidatePayload,
  positionMs: number,
): TimelineState {
  const timeline = payload.timeline;
  const exact = timeline.find(
    (event) => event.startMs <= positionMs && positionMs < event.endMs,
  );
  const previous = [...timeline]
    .reverse()
    .find((event) => event.startMs <= positionMs);
  const event = exact ?? previous ?? null;
  const listeningEnd = timeline.find((item) => item.type === "LISTENING_END");

  return {
    positionMs,
    event,
    sectionId: event?.sectionId ?? null,
    groupId: event?.groupId ?? null,
    questionId: event?.questionId ?? null,
    listeningEnded: Boolean(
      listeningEnd && positionMs >= listeningEnd.startMs,
    ),
  };
}

export function listeningDurationMs(payload: CandidatePayload) {
  const end = payload.timeline.find((event) => event.type === "LISTENING_END");
  return end?.startMs ?? payload.test.fullListeningAudio?.durationMs ?? 0;
}
