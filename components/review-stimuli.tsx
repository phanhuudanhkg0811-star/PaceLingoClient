"use client";
/* eslint-disable @next/next/no-img-element */

import type { CandidateStimulus } from "@/lib/candidate-types";
import { SafeContentHtml } from "./safe-content-html";

export function ReviewStimuli({ stimuli }: { stimuli: CandidateStimulus[] }) {
  const visible = stimuli.filter(
    (stimulus) => stimulus.type !== "AUDIO" || stimulus.media,
  );
  if (!visible.length) return null;
  return (
    <div className="space-y-4">
      {visible.map((stimulus, index) => (
        <div key={stimulus.id}>
          {visible.length > 1 && stimulus.type !== "AUDIO" && (
            <p className="mb-2 text-xs font-black uppercase tracking-wider text-accent-strong">Passage {index + 1}</p>
          )}
          {stimulus.type === "HTML" && (
            <SafeContentHtml html={stimulus.contentHtml ?? ""} />
          )}
          {stimulus.type === "IMAGE" && stimulus.media && (
            <img
              src={stimulus.media.url}
              alt={stimulus.altText ?? stimulus.media.altText ?? "Nội dung câu hỏi"}
              className="mx-auto max-h-[680px] max-w-full object-contain"
            />
          )}
          {stimulus.type === "AUDIO" && stimulus.media && (
            <audio controls preload="metadata" className="w-full" src={stimulus.media.url}>
              Trình duyệt không hỗ trợ audio.
            </audio>
          )}
        </div>
      ))}
    </div>
  );
}
