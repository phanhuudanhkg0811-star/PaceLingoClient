"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/auth-client";
import type {
  MediaAsset,
  Question,
  QuestionGroup,
  Stimulus,
  TestTree,
  TestValidation,
  TimelineEvent,
} from "@/lib/test-editor-types";
import { ThemeToggle } from "./theme-toggle";

type EditorTab = "content" | "timeline" | "preview" | "validation";

export function TestEditor({ testId }: { testId: string }) {
  const [test, setTest] = useState<TestTree | null>(null);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [tab, setTab] = useState<EditorTab>("content");
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    async (initial = false) => {
      try {
        const [testResponse, imageResponse, audioResponse] = await Promise.all([
          apiFetch(`/admin/tests/${testId}`),
          apiFetch("/admin/media?type=IMAGE&pageSize=50"),
          apiFetch("/admin/media?type=AUDIO&pageSize=50"),
        ]);
        if (!testResponse.ok)
          throw new Error(await responseMessage(testResponse));
        if (!imageResponse.ok)
          throw new Error(await responseMessage(imageResponse));
        if (!audioResponse.ok)
          throw new Error(await responseMessage(audioResponse));
        const tree = (await testResponse.json()) as TestTree;
        const images = (await imageResponse.json()) as { items: MediaAsset[] };
        const audio = (await audioResponse.json()) as { items: MediaAsset[] };
        setTest(tree);
        setMedia([...images.items, ...audio.items]);
        if (initial || !sectionId) {
          const firstSection = tree.sections[0];
          const firstGroup = firstSection?.questionGroups[0];
          setSectionId(firstSection?.id ?? null);
          setGroupId(firstGroup?.id ?? null);
          setQuestionId(firstGroup?.questions[0]?.id ?? null);
        }
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "Không thể tải Test Draft",
        );
      } finally {
        setLoading(false);
      }
    },
    [sectionId, testId],
  );

  useEffect(() => {
    queueMicrotask(() => void load(true));
    // Initial load only; selection-preserving reloads are called explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId]);

  const selection = useMemo(() => {
    const section =
      test?.sections.find((item) => item.id === sectionId) ?? test?.sections[0];
    const group =
      section?.questionGroups.find((item) => item.id === groupId) ??
      section?.questionGroups[0];
    const question =
      group?.questions.find((item) => item.id === questionId) ??
      group?.questions[0];
    return { section, group, question };
  }, [groupId, questionId, sectionId, test]);

  async function mutate(path: string, init: RequestInit, success?: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch(path, init);
      if (!response.ok) throw new Error(await responseMessage(response));
      if (success) setNotice(success);
      await load(false);
      return response;
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể lưu thay đổi",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <main className="grid min-h-screen place-items-center text-muted">
        Đang mở Test Editor…
      </main>
    );
  if (!test)
    return (
      <main className="grid min-h-screen place-items-center text-danger">
        {error ?? "Không tìm thấy đề"}
      </main>
    );
  const editable = test.status === "DRAFT";

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-[1700px] flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/admin/tests"
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-surface"
            >
              ←
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate font-bold">{test.title}</h1>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-black ${editable ? "bg-amber-400/15 text-amber-600 dark:text-amber-300" : "bg-accent-soft text-accent-strong"}`}
                >
                  {test.status}
                </span>
              </div>
              <p className="text-xs text-muted">
                {test.totalQuestions} câu · {test.durationMinutes} phút ·{" "}
                {busy ? "Đang lưu…" : "Đã đồng bộ"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex rounded-xl border border-border bg-surface p-1 text-xs font-bold">
              {(
                ["content", "timeline", "preview", "validation"] as EditorTab[]
              ).map((item) => (
                <button
                  key={item}
                  onClick={() => setTab(item)}
                  className={`rounded-lg px-3 py-2 capitalize ${tab === item ? "bg-accent text-white dark:text-slate-950" : "text-muted hover:text-foreground"}`}
                >
                  {item}
                </button>
              ))}
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1700px] px-4 py-5 sm:px-6">
        {(error || notice) && (
          <div
            className={`mb-5 flex justify-between rounded-2xl px-4 py-3 text-sm ${error ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent-strong"}`}
          >
            <span>{error ?? notice}</span>
            <button
              onClick={() => {
                setError(null);
                setNotice(null);
              }}
            >
              ×
            </button>
          </div>
        )}
        {tab === "content" && (
          <ContentEditor
            test={test}
            media={media}
            selection={selection}
            editable={editable}
            busy={busy}
            onSelectSection={(id) => {
              setSectionId(id);
              const section = test.sections.find((item) => item.id === id);
              const group = section?.questionGroups[0];
              setGroupId(group?.id ?? null);
              setQuestionId(group?.questions[0]?.id ?? null);
            }}
            onSelectGroup={(id) => {
              setGroupId(id);
              const group = test.sections
                .flatMap((item) => item.questionGroups)
                .find((item) => item.id === id);
              setQuestionId(group?.questions[0]?.id ?? null);
            }}
            onSelectQuestion={setQuestionId}
            mutate={mutate}
          />
        )}
        {tab === "timeline" && (
          <TimelineEditor
            test={test}
            editable={editable}
            busy={busy}
            mutate={mutate}
          />
        )}
        {tab === "preview" && (
          <CandidatePreview test={test} selectedGroup={selection.group} />
        )}
        {tab === "validation" && (
          <ValidationPanel
            test={test}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            setNotice={setNotice}
            reload={() => load(false)}
          />
        )}
      </div>
    </main>
  );
}

function ContentEditor({
  test,
  media,
  selection,
  editable,
  busy,
  onSelectSection,
  onSelectGroup,
  onSelectQuestion,
  mutate,
}: {
  test: TestTree;
  media: MediaAsset[];
  selection: {
    section: TestTree["sections"][number] | undefined;
    group: QuestionGroup | undefined;
    question: Question | undefined;
  };
  editable: boolean;
  busy: boolean;
  onSelectSection: (id: string) => void;
  onSelectGroup: (id: string) => void;
  onSelectQuestion: (id: string) => void;
  mutate: (
    path: string,
    init: RequestInit,
    success?: string,
  ) => Promise<Response | null>;
}) {
  const { section, group, question } = selection;
  return (
    <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)_430px]">
      <aside className="h-fit rounded-3xl border border-border bg-surface p-3 xl:sticky xl:top-20">
        <MetadataForm
          test={test}
          media={media}
          editable={editable}
          mutate={mutate}
        />
        <div className="mt-4 border-t border-border pt-3">
          {test.sections.map((item) => (
            <div key={item.id}>
              <button
                onClick={() => onSelectSection(item.id)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-bold ${section?.id === item.id ? "bg-accent-soft text-accent-strong" : "hover:bg-surface-raised"}`}
              >
                <span>
                  {item.part?.replace("PART_", "Part ") ?? item.title}
                </span>
                <span>
                  {item.questionGroups.reduce(
                    (sum, g) => sum + g.questions.length,
                    0,
                  )}
                </span>
              </button>
              {section?.id === item.id && (
                <div className="ml-3 mt-1 border-l border-border pl-2">
                  {item.questionGroups.map((g, index) => (
                    <button
                      key={g.id}
                      onClick={() => onSelectGroup(g.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        const draggedQuestionId =
                          event.dataTransfer.getData("text/question-id");
                        if (draggedQuestionId) {
                          void mutate(
                            `/admin/tests/questions/${draggedQuestionId}/move`,
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ targetGroupId: g.id }),
                            },
                            "Đã chuyển câu hỏi",
                          );
                          onSelectGroup(g.id);
                        }
                      }}
                      className={`block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs ${group?.id === g.id ? "bg-surface-raised font-bold text-accent" : "text-muted hover:text-foreground"}`}
                    >
                      Group {index + 1} · {g.type.replaceAll("_", " ")}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>
      <section className="min-w-0 space-y-5">
        {group ? (
          <>
            <GroupEditor
              key={group.id}
              group={group}
              editable={editable}
              mutate={mutate}
            />
            <StimulusEditor
              group={group}
              media={media}
              editable={editable}
              busy={busy}
              mutate={mutate}
            />
            <div className="rounded-3xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-accent">
                    Questions
                  </p>
                  <h2 className="mt-1 text-xl font-bold">
                    {group.questions.length} câu trong group
                  </h2>
                </div>
                {editable && (
                  <button
                    onClick={() => void addQuestion(group, test, mutate)}
                    className="rounded-xl bg-accent px-3 py-2 text-xs font-bold text-white dark:text-slate-950"
                  >
                    + Câu hỏi
                  </button>
                )}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {group.questions.map((item) => (
                  <button
                    key={item.id}
                    draggable={editable}
                    onDragStart={(event) =>
                      event.dataTransfer.setData("text/question-id", item.id)
                    }
                    onClick={() => onSelectQuestion(item.id)}
                    className={`rounded-2xl border p-4 text-left ${question?.id === item.id ? "border-accent bg-accent-soft/40" : "border-border hover:border-accent/40"}`}
                  >
                    <span className="text-xs font-black text-accent">
                      Câu {item.number}
                    </span>
                    <HtmlText html={item.promptHtml} />
                    <div className="mt-3 flex gap-1">
                      {item.options.map((option) => (
                        <span
                          key={option.id}
                          className={`grid size-6 place-items-center rounded-full text-[10px] font-bold ${option.isCorrect ? "bg-accent text-white dark:text-slate-950" : "bg-surface-raised text-muted"}`}
                        >
                          {option.label}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <Empty text="Chọn một question group" />
        )}
      </section>
      <aside className="h-fit xl:sticky xl:top-20">
        {question && group ? (
          <QuestionForm
            key={`${question.id}-${question.options.map((o) => o.id).join()}`}
            question={question}
            group={group}
            allGroups={test.sections.flatMap((s) => s.questionGroups)}
            media={media}
            editable={editable}
            busy={busy}
            mutate={mutate}
            onSelect={onSelectQuestion}
          />
        ) : (
          <Empty text="Chọn một câu hỏi để chỉnh sửa" />
        )}
      </aside>
    </div>
  );
}

function MetadataForm({
  test,
  media,
  editable,
  mutate,
}: {
  test: TestTree;
  media: MediaAsset[];
  editable: boolean;
  mutate: ContentProps["mutate"];
}) {
  const [title, setTitle] = useState(test.title);
  const [description, setDescription] = useState(test.description ?? "");
  const [duration, setDuration] = useState(test.durationMinutes);
  const [audioId, setAudioId] = useState(test.fullListeningAudioId ?? "");
  const [testType, setTestType] = useState(test.type);
  async function save(fullAudioId = audioId, nextType = testType) {
    if (!editable) return;
    await mutate(`/admin/tests/${test.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || null,
        type: nextType,
        durationMinutes: duration,
        fullListeningAudioId: fullAudioId || null,
      }),
    });
  }
  return (
    <div>
      <p className="px-2 text-[10px] font-black uppercase tracking-widest text-accent">
        Metadata · autosave on blur
      </p>
      <input
        value={title}
        disabled={!editable}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => void save()}
        className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-bold"
      />
      <textarea
        value={description}
        disabled={!editable}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => void save()}
        rows={2}
        placeholder="Mô tả đề"
        className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
      />
      <label className="mt-2 block text-[10px] text-muted">
        Loại đề
        <select
          value={testType}
          disabled={!editable}
          onChange={(event) => {
            const value = event.target.value as TestTree["type"];
            setTestType(value);
            queueMicrotask(() => void save(audioId, value));
          }}
          className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-xs text-foreground"
        >
          <option value="FULL_TEST">Full Test · chuẩn 200 câu</option>
          <option value="MINI_TEST">Mini Test · tùy Part/số câu</option>
          <option value="PART_PRACTICE">Part Practice · luyện một Part</option>
        </select>
      </label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-[10px] text-muted">
          Phút
          <input
            type="number"
            value={duration}
            disabled={!editable}
            onChange={(e) => setDuration(Number(e.target.value))}
            onBlur={() => void save()}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-xs text-foreground"
          />
        </label>
        <label className="text-[10px] text-muted">
          Full audio
          <select
            value={audioId}
            disabled={!editable}
            onChange={(e) => {
              const value = e.target.value;
              setAudioId(value);
              queueMicrotask(() => void save(value));
            }}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-xs text-foreground"
          >
            <option value="">—</option>
            {media
              .filter((m) => m.type === "AUDIO")
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.originalName}
                </option>
              ))}
          </select>
        </label>
      </div>
    </div>
  );
}

type ContentProps = {
  mutate: (
    path: string,
    init: RequestInit,
    success?: string,
  ) => Promise<Response | null>;
};
function GroupEditor({
  group,
  editable,
  mutate,
}: {
  group: QuestionGroup;
  editable: boolean;
  mutate: ContentProps["mutate"];
}) {
  const [title, setTitle] = useState(group.title ?? "");
  const [transcript, setTranscript] = useState(group.transcriptHtml ?? "");
  async function save() {
    await mutate(`/admin/tests/groups/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title || null,
        transcriptHtml: transcript || null,
      }),
    });
  }
  return (
    <div className="rounded-3xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-accent">
            Question group
          </p>
          <h2 className="mt-1 text-xl font-bold">
            {group.type.replaceAll("_", " ")}
          </h2>
        </div>
        <span className="text-xs text-muted">Autosave on blur</span>
      </div>
      <input
        value={title}
        disabled={!editable}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => void save()}
        placeholder="Tên group (optional)"
        className="mt-4 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm"
      />
      <textarea
        value={transcript}
        disabled={!editable}
        onChange={(e) => setTranscript(e.target.value)}
        onBlur={() => void save()}
        rows={4}
        placeholder="Transcript HTML cho Listening…"
        className="mt-3 w-full rounded-xl border border-border bg-background px-4 py-3 font-mono text-xs leading-6"
      />
    </div>
  );
}

function EditableStimulus({
  stimulus,
  media,
  editable,
  mutate,
}: {
  stimulus: Stimulus;
  media: MediaAsset[];
  editable: boolean;
  mutate: ContentProps["mutate"];
}) {
  const [contentHtml, setContentHtml] = useState(stimulus.contentHtml ?? "");
  const [mediaAssetId, setMediaAssetId] = useState(stimulus.mediaAssetId ?? "");
  const [altText, setAltText] = useState(stimulus.altText ?? "");

  async function save(nextMediaId = mediaAssetId) {
    if (!editable) return;
    await mutate(`/admin/tests/stimuli/${stimulus.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: stimulus.type,
        contentHtml: stimulus.type === "HTML" ? contentHtml : null,
        mediaAssetId: stimulus.type === "HTML" ? null : nextMediaId || null,
        altText: altText || null,
        order: stimulus.order,
      }),
    });
  }

  if (stimulus.type === "HTML") {
    return (
      <div>
        <HtmlFrame html={contentHtml} passage />
        {editable && (
          <textarea
            value={contentHtml}
            onChange={(event) => setContentHtml(event.target.value)}
            onBlur={() => void save()}
            rows={5}
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs leading-5"
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <StimulusPreview
        stimulus={{
          ...stimulus,
          mediaAssetId: mediaAssetId || null,
          mediaAsset:
            media.find((item) => item.id === mediaAssetId) ??
            stimulus.mediaAsset,
          altText,
        }}
      />
      {editable && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <select
            value={mediaAssetId}
            onChange={(event) => {
              const value = event.target.value;
              setMediaAssetId(value);
              queueMicrotask(() => void save(value));
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
          >
            <option value="">Chọn {stimulus.type.toLowerCase()}…</option>
            {media
              .filter((item) => item.type === stimulus.type)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.originalName}
                </option>
              ))}
          </select>
          <input
            value={altText}
            onChange={(event) => setAltText(event.target.value)}
            onBlur={() => void save()}
            placeholder="Alt text / ghi chú"
            className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
          />
        </div>
      )}
    </div>
  );
}

function StimulusEditor({
  group,
  media,
  editable,
  busy,
  mutate,
}: {
  group: QuestionGroup;
  media: MediaAsset[];
  editable: boolean;
  busy: boolean;
  mutate: ContentProps["mutate"];
}) {
  const [kind, setKind] = useState<"HTML" | "IMAGE" | "AUDIO">("HTML");
  const [html, setHtml] = useState("");
  const [mediaId, setMediaId] = useState("");
  async function add() {
    await mutate(
      `/admin/tests/groups/${group.id}/stimuli`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: kind,
          contentHtml: kind === "HTML" ? html : null,
          mediaAssetId: kind !== "HTML" ? mediaId : null,
          altText: null,
        }),
      },
      "Đã thêm stimulus",
    );
    setHtml("");
    setMediaId("");
  }
  async function remove(id: string) {
    if (confirm("Xóa passage/media này?"))
      await mutate(`/admin/tests/stimuli/${id}`, { method: "DELETE" });
  }
  async function move(index: number, direction: number) {
    const ids = [...group.stimuli.map((s) => s.id)];
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await mutate(`/admin/tests/groups/${group.id}/stimuli/order`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stimulusIds: ids }),
    });
  }
  return (
    <div className="rounded-3xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-accent">
            Stimuli / Passage
          </p>
          <h2 className="mt-1 text-xl font-bold">
            {group.stimuli.length} tài nguyên
          </h2>
        </div>
        <Link href="/admin/media" className="text-xs font-bold text-accent">
          Mở Media Library ↗
        </Link>
      </div>
      <div className="mt-4 space-y-3">
        {group.stimuli.map((stimulus, index) => (
          <div
            key={stimulus.id}
            className="rounded-2xl border border-border p-3"
          >
            <EditableStimulus
              stimulus={stimulus}
              media={media}
              editable={editable}
              mutate={mutate}
            />
            {editable && (
              <div className="mt-2 flex justify-end gap-2 text-xs">
                <button
                  onClick={() => void move(index, -1)}
                  disabled={index === 0}
                >
                  ↑
                </button>
                <button
                  onClick={() => void move(index, 1)}
                  disabled={index === group.stimuli.length - 1}
                >
                  ↓
                </button>
                <button
                  onClick={() => void remove(stimulus.id)}
                  className="text-danger"
                >
                  Xóa
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {editable && (
        <div className="mt-4 rounded-2xl bg-surface-raised p-3">
          <div className="flex gap-2">
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as typeof kind);
                setMediaId("");
              }}
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
            >
              <option>HTML</option>
              <option>IMAGE</option>
              <option>AUDIO</option>
            </select>
            {kind === "HTML" ? (
              <textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                placeholder="<article>Passage HTML…</article>"
                className="min-h-20 flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
              />
            ) : (
              <select
                value={mediaId}
                onChange={(e) => setMediaId(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs"
              >
                <option value="">Chọn {kind.toLowerCase()}…</option>
                {media
                  .filter((m) => m.type === kind)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.originalName}
                    </option>
                  ))}
              </select>
            )}
          </div>
          <button
            disabled={
              busy ||
              (!html && kind === "HTML") ||
              (!mediaId && kind !== "HTML")
            }
            onClick={() => void add()}
            className="mt-2 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white disabled:opacity-40 dark:text-slate-950"
          >
            + Thêm stimulus
          </button>
        </div>
      )}
    </div>
  );
}

function QuestionForm({
  question,
  group,
  allGroups,
  media,
  editable,
  busy,
  mutate,
  onSelect,
}: {
  question: Question;
  group: QuestionGroup;
  allGroups: QuestionGroup[];
  media: MediaAsset[];
  editable: boolean;
  busy: boolean;
  mutate: ContentProps["mutate"];
  onSelect: (id: string) => void;
}) {
  const [number, setNumber] = useState(question.number);
  const [prompt, setPrompt] = useState(question.promptHtml);
  const [explanation, setExplanation] = useState(
    question.explanationHtml ?? "",
  );
  const [topic, setTopic] = useState(question.grammarTopic ?? "");
  const [tags, setTags] = useState(question.vocabularyTags.join(", "));
  const [difficulty, setDifficulty] = useState(question.difficulty ?? "");
  const [options, setOptions] = useState(
    question.options.map((o) => ({
      label: o.label,
      contentHtml: o.contentHtml,
      isCorrect: o.isCorrect,
      order: o.order,
    })),
  );
  async function save() {
    const response = await mutate(
      `/admin/tests/questions/${question.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number,
          promptHtml: prompt,
          explanationHtml: explanation || null,
          grammarTopic: topic || null,
          vocabularyTags: tags
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
          difficulty: difficulty || null,
          options,
        }),
      },
      "Đã lưu câu hỏi",
    );
    return response;
  }
  async function duplicate() {
    const response = await mutate(
      `/admin/tests/questions/${question.id}/duplicate`,
      { method: "POST" },
      "Đã nhân bản câu hỏi",
    );
    if (response) {
      const data = (await response.json()) as Question;
      onSelect(data.id);
    }
  }
  async function remove() {
    if (confirm(`Xóa câu ${question.number}?`)) {
      await mutate(`/admin/tests/questions/${question.id}`, {
        method: "DELETE",
      });
    }
  }
  async function move(targetGroupId: string) {
    if (targetGroupId !== group.id)
      await mutate(
        `/admin/tests/questions/${question.id}/move`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetGroupId }),
        },
        "Đã chuyển câu hỏi",
      );
  }
  return (
    <div className="rounded-3xl border border-border bg-surface p-5 shadow-[0_16px_45px_rgba(var(--shadow),0.06)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-accent">
            Question editor
          </p>
          <h2 className="mt-1 text-xl font-bold">Câu {question.number}</h2>
        </div>
        {editable && (
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => void duplicate()}
              className="rounded-lg border border-border px-2 py-1"
            >
              Nhân bản
            </button>
            <button
              onClick={() => void remove()}
              className="rounded-lg px-2 py-1 text-danger"
            >
              Xóa
            </button>
          </div>
        )}
      </div>
      <div className="mt-4 grid grid-cols-[90px_1fr] gap-2">
        <input
          type="number"
          value={number}
          disabled={!editable}
          onChange={(e) => setNumber(Number(e.target.value))}
          className="rounded-xl border border-border bg-background px-3 py-2"
        />
        <select
          value={group.id}
          disabled={!editable}
          onChange={(e) => void move(e.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
        >
          {allGroups.map((g, index) => (
            <option key={g.id} value={g.id}>
              Group {index + 1} · {g.type}
            </option>
          ))}
        </select>
      </div>
      <label className="mt-3 block text-xs font-bold">
        Prompt HTML
        <textarea
          value={prompt}
          disabled={!editable}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs leading-5"
        />
      </label>
      <div className="mt-3 space-y-2">
        {options.map((option, index) => (
          <div
            key={index}
            className="grid grid-cols-[28px_38px_1fr] items-center gap-2"
          >
            <input
              type="radio"
              checked={option.isCorrect}
              disabled={!editable}
              onChange={() =>
                setOptions((items) =>
                  items.map((item, i) => ({ ...item, isCorrect: i === index })),
                )
              }
            />
            <input
              value={option.label}
              disabled={!editable}
              onChange={(e) =>
                setOptions((items) =>
                  items.map((item, i) =>
                    i === index ? { ...item, label: e.target.value } : item,
                  ),
                )
              }
              className="rounded-lg border border-border bg-background px-2 py-2 text-center text-xs font-bold"
            />
            <input
              value={option.contentHtml}
              disabled={!editable}
              onChange={(e) =>
                setOptions((items) =>
                  items.map((item, i) =>
                    i === index
                      ? { ...item, contentHtml: e.target.value }
                      : item,
                  ),
                )
              }
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs"
            />
          </div>
        ))}
      </div>
      <label className="mt-3 block text-xs font-bold">
        Giải thích
        <textarea
          value={explanation}
          disabled={!editable}
          onChange={(e) => setExplanation(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs"
        />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <input
          value={topic}
          disabled={!editable}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Grammar topic"
          className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
        />
        <select
          value={difficulty}
          disabled={!editable}
          onChange={(e) => setDifficulty(e.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
        >
          <option value="">Difficulty —</option>
          <option>EASY</option>
          <option>MEDIUM</option>
          <option>HARD</option>
        </select>
      </div>
      <input
        value={tags}
        disabled={!editable}
        onChange={(e) => setTags(e.target.value)}
        placeholder="vocabulary, tags"
        className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
      />
      {editable && (
        <button
          disabled={busy || !prompt || options.some((o) => !o.contentHtml)}
          onClick={() => void save()}
          className="mt-4 w-full rounded-xl bg-accent px-4 py-3 font-bold text-white disabled:opacity-40 dark:text-slate-950"
        >
          Lưu câu hỏi
        </button>
      )}
      <AudioSegments
        question={question}
        media={media}
        editable={editable}
        mutate={mutate}
      />
    </div>
  );
}

function AudioSegments({
  question,
  media,
  editable,
  mutate,
}: {
  question: Question;
  media: MediaAsset[];
  editable: boolean;
  mutate: ContentProps["mutate"];
}) {
  const [segments, setSegments] = useState(
    question.audioSegments.map((s) => ({
      audioAssetId: s.audioAssetId,
      startMs: s.startMs,
      endMs: s.endMs,
      segmentType: s.segmentType,
    })),
  );
  async function save() {
    await mutate(
      `/admin/tests/questions/${question.id}/audio-segments`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments }),
      },
      "Đã lưu audio segments",
    );
  }
  return (
    <details className="mt-4 border-t border-border pt-3">
      <summary className="cursor-pointer text-xs font-bold text-accent">
        Audio evidence/context ({segments.length})
      </summary>
      <div className="mt-3 space-y-2">
        {segments.map((segment, index) => (
          <div
            key={index}
            className="grid grid-cols-2 gap-2 rounded-xl bg-surface-raised p-2"
          >
            <select
              value={segment.audioAssetId}
              disabled={!editable}
              onChange={(e) =>
                setSegments((items) =>
                  items.map((item, i) =>
                    i === index
                      ? { ...item, audioAssetId: e.target.value }
                      : item,
                  ),
                )
              }
              className="col-span-2 rounded-lg border border-border bg-background p-2 text-xs"
            >
              {media
                .filter((m) => m.type === "AUDIO")
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.originalName}
                  </option>
                ))}
            </select>
            <input
              type="number"
              value={segment.startMs}
              onChange={(e) =>
                setSegments((items) =>
                  items.map((item, i) =>
                    i === index
                      ? { ...item, startMs: Number(e.target.value) }
                      : item,
                  ),
                )
              }
              className="rounded-lg border border-border bg-background p-2 text-xs"
            />
            <input
              type="number"
              value={segment.endMs}
              onChange={(e) =>
                setSegments((items) =>
                  items.map((item, i) =>
                    i === index
                      ? { ...item, endMs: Number(e.target.value) }
                      : item,
                  ),
                )
              }
              className="rounded-lg border border-border bg-background p-2 text-xs"
            />
            <select
              value={segment.segmentType}
              onChange={(e) =>
                setSegments((items) =>
                  items.map((item, i) =>
                    i === index
                      ? {
                          ...item,
                          segmentType: e.target
                            .value as typeof item.segmentType,
                        }
                      : item,
                  ),
                )
              }
              className="rounded-lg border border-border bg-background p-2 text-xs"
            >
              <option>ANSWER_EVIDENCE</option>
              <option>CONTEXT</option>
            </select>
            <button
              onClick={() =>
                setSegments((items) => items.filter((_, i) => i !== index))
              }
              className="text-xs text-danger"
            >
              Xóa
            </button>
            {media.find((item) => item.id === segment.audioAssetId) && (
              <audio
                controls
                preload="metadata"
                src={`${media.find((item) => item.id === segment.audioAssetId)!.url}#t=${segment.startMs / 1000},${segment.endMs / 1000}`}
                className="col-span-2 h-8 w-full"
              />
            )}
          </div>
        ))}
      </div>
      {editable && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => {
              const audio = media.find((m) => m.type === "AUDIO");
              if (audio)
                setSegments((items) => [
                  ...items,
                  {
                    audioAssetId: audio.id,
                    startMs: 0,
                    endMs: 1000,
                    segmentType: "ANSWER_EVIDENCE",
                  },
                ]);
            }}
            className="rounded-lg border border-border px-3 py-2 text-xs"
          >
            + Segment
          </button>
          <button
            onClick={() => void save()}
            className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white dark:text-slate-950"
          >
            Lưu segments
          </button>
        </div>
      )}
    </details>
  );
}

async function addQuestion(
  group: QuestionGroup,
  test: TestTree,
  mutate: ContentProps["mutate"],
) {
  const max = Math.max(
    0,
    ...test.sections.flatMap((s) =>
      s.questionGroups.flatMap((g) => g.questions.map((q) => q.number)),
    ),
  );
  await mutate(
    `/admin/tests/groups/${group.id}/questions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        number: max + 1,
        promptHtml: "<p>New question</p>",
        explanationHtml: null,
        grammarTopic: null,
        vocabularyTags: [],
        difficulty: null,
        options: ["A", "B", "C", "D"].map((label, order) => ({
          label,
          contentHtml: `Option ${label}`,
          isCorrect: order === 0,
          order,
        })),
      }),
    },
    "Đã thêm câu hỏi",
  );
}

function TimelineEditor({
  test,
  editable,
  busy,
  mutate,
}: {
  test: TestTree;
  editable: boolean;
  busy: boolean;
  mutate: ContentProps["mutate"];
}) {
  const [events, setEvents] = useState(
    test.timelineEvents.map((event) => ({
      type: event.type,
      startMs: event.startMs,
      endMs: event.endMs,
      order: event.order,
      sectionId: event.sectionId,
      groupId: event.groupId,
      questionId: event.questionId,
    })),
  );
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const activeEvent = events.find(
    (event) => currentMs >= event.startMs && currentMs < event.endMs,
  );
  function add() {
    const current = Math.round((audioRef.current?.currentTime ?? 0) * 1000);
    setEvents((items) => [
      ...items,
      {
        type: "QUESTION_GROUP",
        startMs: current,
        endMs: current + 1000,
        order: items.length,
        sectionId: null,
        groupId: null,
        questionId: null,
      },
    ]);
  }
  function setTarget(index: number, value: string) {
    const [kind, id] = value.split(":");
    setEvents((items) =>
      items.map((item, i) =>
        i === index
          ? {
              ...item,
              sectionId: kind === "section" ? id : null,
              groupId: kind === "group" ? id : null,
              questionId: kind === "question" ? id : null,
            }
          : item,
      ),
    );
  }
  function target(event: Omit<TimelineEvent, "id">) {
    return event.questionId
      ? `question:${event.questionId}`
      : event.groupId
        ? `group:${event.groupId}`
        : event.sectionId
          ? `section:${event.sectionId}`
          : "";
  }
  async function save() {
    await mutate(
      `/admin/tests/${test.id}/timeline`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: events.map((event, order) => ({ ...event, order })),
        }),
      },
      "Đã lưu timeline",
    );
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <aside className="h-fit rounded-3xl border border-border bg-surface p-5 xl:sticky xl:top-20">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">
          Full Listening audio
        </p>
        {test.fullListeningAudio ? (
          <>
            <h2 className="mt-2 truncate font-bold">
              {test.fullListeningAudio.originalName}
            </h2>
            <audio
              ref={audioRef}
              controls
              src={test.fullListeningAudio.url}
              onTimeUpdate={(event) =>
                setCurrentMs(Math.round(event.currentTarget.currentTime * 1000))
              }
              className="mt-4 w-full"
            />
            <div className="mt-3 rounded-2xl bg-surface-raised p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold">
                  {formatMs(currentMs)}
                </span>
                <span className={activeEvent ? "text-accent" : "text-muted"}>
                  {activeEvent ? "EVENT ACTIVE" : "NO EVENT"}
                </span>
              </div>
              <p className="mt-2 font-bold">
                {activeEvent?.type ?? "Khoảng audio chưa được ánh xạ"}
              </p>
              {activeEvent && (
                <p className="mt-1 text-xs text-muted">
                  {activeEvent.questionId
                    ? `Question ${activeEvent.questionId}`
                    : activeEvent.groupId
                      ? `Group ${activeEvent.groupId}`
                      : activeEvent.sectionId
                        ? `Section ${activeEvent.sectionId}`
                        : "Không có target"}
                </p>
              )}
            </div>
            <p className="mt-3 text-xs leading-5 text-muted">
              Phát audio, dừng tại mốc cần đánh dấu rồi dùng nút Start/End trên
              event.
            </p>
          </>
        ) : (
          <p className="mt-3 rounded-xl bg-danger-soft p-3 text-sm text-danger">
            Chưa gắn full Listening audio trong tab Content.
          </p>
        )}
        <button
          disabled={!editable || !test.fullListeningAudio}
          onClick={add}
          className="mt-4 w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white disabled:opacity-40 dark:text-slate-950"
        >
          + Event tại thời gian hiện tại
        </button>
      </aside>
      <section className="rounded-3xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-accent">
              Timeline authoring
            </p>
            <h2 className="mt-1 text-xl font-bold">{events.length} events</h2>
          </div>
          {editable && (
            <button
              disabled={busy}
              onClick={() => void save()}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white dark:text-slate-950"
            >
              Lưu timeline
            </button>
          )}
        </div>
        <div className="mt-5 space-y-3">
          {events.map((event, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-2xl border border-border p-3 lg:grid-cols-[150px_110px_110px_1fr_auto]"
            >
              <select
                value={event.type}
                disabled={!editable}
                onChange={(e) =>
                  setEvents((items) =>
                    items.map((item, i) =>
                      i === index
                        ? { ...item, type: e.target.value as typeof item.type }
                        : item,
                    ),
                  )
                }
                className="rounded-lg border border-border bg-background p-2 text-xs"
              >
                {[
                  "DIRECTION",
                  "EXAMPLE",
                  "QUESTION",
                  "QUESTION_GROUP",
                  "PART_TRANSITION",
                  "LISTENING_END",
                ].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
              <TimeInput
                value={event.startMs}
                onChange={(value) =>
                  setEvents((items) =>
                    items.map((item, i) =>
                      i === index ? { ...item, startMs: value } : item,
                    ),
                  )
                }
                capture={() =>
                  setEvents((items) =>
                    items.map((item, i) =>
                      i === index
                        ? {
                            ...item,
                            startMs: Math.round(
                              (audioRef.current?.currentTime ?? 0) * 1000,
                            ),
                          }
                        : item,
                    ),
                  )
                }
              />
              <TimeInput
                value={event.endMs}
                onChange={(value) =>
                  setEvents((items) =>
                    items.map((item, i) =>
                      i === index ? { ...item, endMs: value } : item,
                    ),
                  )
                }
                capture={() =>
                  setEvents((items) =>
                    items.map((item, i) =>
                      i === index
                        ? {
                            ...item,
                            endMs: Math.round(
                              (audioRef.current?.currentTime ?? 0) * 1000,
                            ),
                          }
                        : item,
                    ),
                  )
                }
              />
              <select
                value={target(event)}
                disabled={!editable}
                onChange={(e) => setTarget(index, e.target.value)}
                className="min-w-0 rounded-lg border border-border bg-background p-2 text-xs"
              >
                <option value="">Không gắn target</option>
                {test.sections.map((s) => (
                  <option key={s.id} value={`section:${s.id}`}>
                    {s.part}
                  </option>
                ))}
                {test.sections.flatMap((s) =>
                  s.questionGroups.map((g, i) => (
                    <option key={g.id} value={`group:${g.id}`}>
                      {s.part} · Group {i + 1}
                    </option>
                  )),
                )}
                {test.sections.flatMap((s) =>
                  s.questionGroups.flatMap((g) =>
                    g.questions.map((q) => (
                      <option key={q.id} value={`question:${q.id}`}>
                        Câu {q.number}
                      </option>
                    )),
                  ),
                )}
              </select>
              <button
                disabled={!editable}
                onClick={() =>
                  setEvents((items) => items.filter((_, i) => i !== index))
                }
                className="px-2 text-danger"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
function TimeInput({
  value,
  onChange,
  capture,
}: {
  value: number;
  onChange: (value: number) => void;
  capture: () => void;
}) {
  return (
    <div className="flex">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 w-full rounded-l-lg border border-border bg-background p-2 text-xs"
      />
      <button
        onClick={capture}
        className="rounded-r-lg border border-l-0 border-border px-2 text-[10px]"
      >
        ●
      </button>
    </div>
  );
}

function formatMs(value: number) {
  const totalSeconds = Math.floor(value / 1000);
  const milliseconds = String(value % 1000).padStart(3, "0");
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}.${milliseconds}`;
}

function CandidatePreview({
  test,
  selectedGroup,
}: {
  test: TestTree;
  selectedGroup: QuestionGroup | undefined;
}) {
  const [mobile, setMobile] = useState(false);
  const pages = useMemo(
    () =>
      test.sections
        .filter((section) => section.kind === "READING")
        .flatMap((section) =>
        section.questionGroups.flatMap((group) =>
          section.part === "PART_5"
            ? group.questions.map((question) => ({
                key: `question-${question.id}`,
                section,
                group,
                questions: [question],
              }))
            : [
                {
                  key: `group-${group.id}`,
                  section,
                  group,
                  questions: group.questions,
                },
              ],
        ),
        ),
    [test],
  );
  const initialPage =
    pages.find((page) => page.group.id === selectedGroup?.id) ?? pages[0];
  const [activePageKey, setActivePageKey] = useState(initialPage?.key ?? "");
  const [activeQuestionId, setActiveQuestionId] = useState(
    initialPage?.questions[0]?.id ?? "",
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestionIds, setFlaggedQuestionIds] = useState<string[]>([]);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const pageIndex = Math.max(
    0,
    pages.findIndex((page) => page.key === activePageKey),
  );
  const page = pages[pageIndex];
  const section = page?.section;
  const group = page?.group;
  const visibleQuestions = page?.questions ?? [];
  const activeQuestion =
    visibleQuestions.find((question) => question.id === activeQuestionId) ??
    visibleQuestions[0];
  const questionRange = visibleQuestions.length
    ? `${visibleQuestions[0].number}–${visibleQuestions.at(-1)?.number}`
    : "chưa có câu hỏi";
  const answeredCount = Object.keys(answers).length;
  const readingQuestionCount = pages.reduce(
    (total, currentPage) => total + currentPage.questions.length,
    0,
  );
  const directionText =
    section?.directionTemplate?.directionText ??
    (section?.part === "PART_5"
      ? "Select the best answer to complete the sentence."
      : section?.part === "PART_6"
        ? "Read the text and select the best answer for each question."
        : "Read the following text and select the best answer to each question.");
  const examHours = String(Math.floor(test.durationMinutes / 60)).padStart(
    2,
    "0",
  );
  const examMinutes = String(test.durationMinutes % 60).padStart(2, "0");

  function goToPage(index: number, questionId?: string) {
    const nextPage = pages[index];
    if (!nextPage) return;
    setActivePageKey(nextPage.key);
    setActiveQuestionId(questionId ?? nextPage.questions[0]?.id ?? "");
    setCatalogOpen(false);
  }

  function toggleFlag() {
    if (!activeQuestion) return;
    setFlaggedQuestionIds((current) =>
      current.includes(activeQuestion.id)
        ? current.filter((id) => id !== activeQuestion.id)
        : [...current, activeQuestion.id],
    );
  }
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-accent">
            Candidate mode
          </p>
          <h2 className="mt-1 text-2xl font-bold">Preview như thí sinh</h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Part
            <select
              value={section?.id ?? ""}
              onChange={(event) => {
                const nextPageIndex = pages.findIndex(
                  (item) => item.section.id === event.target.value,
                );
                goToPage(nextPageIndex);
              }}
              className="ml-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs normal-case text-foreground"
            >
              {test.sections
                .filter((item) => item.kind === "READING")
                .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.part?.replace("PART_", "Part ") ?? item.title}
                </option>
                ))}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Trang
            <select
              value={page?.key ?? ""}
              onChange={(event) => {
                const nextPageIndex = pages.findIndex(
                  (item) => item.key === event.target.value,
                );
                goToPage(nextPageIndex);
              }}
              className="ml-2 max-w-52 rounded-lg border border-border bg-surface px-3 py-2 text-xs normal-case text-foreground"
            >
              {pages
                .filter((item) => item.section.id === section?.id)
                .map((item, index) => (
                <option key={item.key} value={item.key}>
                  Trang {index + 1} · Câu {item.questions[0]?.number ?? "—"}
                  {item.questions.length > 1
                    ? `–${item.questions.at(-1)?.number ?? "—"}`
                    : ""}
                </option>
                ))}
            </select>
          </label>
          <div className="flex rounded-xl border border-border bg-surface p-1 text-xs font-bold">
          <button
            onClick={() => setMobile(false)}
            className={`rounded-lg px-3 py-2 ${!mobile ? "bg-accent text-white dark:text-slate-950" : ""}`}
          >
            Desktop
          </button>
          <button
            onClick={() => setMobile(true)}
            className={`rounded-lg px-3 py-2 ${mobile ? "bg-accent text-white dark:text-slate-950" : ""}`}
          >
            Mobile
          </button>
          </div>
        </div>
      </div>
      <div
        className={`relative mx-auto overflow-hidden rounded-3xl border border-slate-300 bg-white text-slate-900 shadow-2xl transition-all ${mobile ? "max-w-[390px]" : "max-w-6xl"}`}
      >
        <div className="grid min-h-16 grid-cols-[auto_1fr_auto] items-center gap-3 bg-[#001b47] px-4 py-2 text-white sm:px-6">
          <div className="rounded-lg bg-white px-3 py-2 text-sm font-black tracking-tight text-[#0b4f91] shadow">
            PACE<span className="text-[#f28b26]">LINGO</span>
          </div>
          <strong className="truncate text-center text-sm sm:text-lg">
            Reading: Question {activeQuestion?.number ?? "—"} of {test.totalQuestions}
          </strong>
          <div className="flex items-center gap-2 text-[10px] font-bold sm:text-xs">
            <span className="hidden rounded-md bg-white px-3 py-2 text-[#18477e] sm:inline">
              {answeredCount}/{readingQuestionCount}
            </span>
            <span className="rounded-md bg-[#2f86d5] px-3 py-2 font-mono">
              ◷ {examHours}:{examMinutes}:00
            </span>
            {section?.kind === "READING" && (
              <button
                type="button"
                onClick={() => setCatalogOpen(true)}
                className="hidden rounded-md bg-[#ef8128] px-4 py-2 text-white sm:block"
              >
                Submit
              </button>
            )}
          </div>
        </div>
        {group ? (
          <div>
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-2 text-xs font-bold text-slate-500">
              {section?.part?.replace("PART_", "Part ") ?? section?.title} · Câu {questionRange}
            </div>
            <div
              className={`grid gap-4 bg-[#f3f3f3] p-4 ${mobile ? "min-h-[600px]" : "h-[calc(100vh-270px)] min-h-[560px] max-h-[780px] md:grid-cols-2"}`}
            >
            <div
              className={`exam-scrollbar min-w-0 border border-slate-300 bg-white p-5 ${mobile ? "" : "overflow-y-auto overscroll-contain"}`}
            >
              <div className="sticky -top-5 z-10 -mx-5 -mt-5 mb-4 border-b border-slate-200 bg-white/95 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 backdrop-blur">
                {section?.part === "PART_5" ? "Directions" : "Passage"}
              </div>
              {section?.part === "PART_5" ? (
                <p className="text-base font-semibold leading-7 text-[#124b78]">
                  {directionText}
                </p>
              ) : group.stimuli.length ? (
                group.stimuli.map((item, index) => (
                  <div key={item.id} className="mb-4">
                    {group.stimuli.length > 1 && (
                      <h3 className="mb-5 mt-8 text-lg font-semibold text-[#124b78] first:mt-0">
                        Passage {index + 1}
                      </h3>
                    )}
                    <StimulusPreview stimulus={item} />
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                  <strong>Group này chưa có passage.</strong>
                  <p className="mt-1 text-xs leading-5">
                    Vào tab Content → Stimuli / Passage để thêm HTML hoặc ảnh.
                    Nếu vừa import, kiểm tra JSON có trường <code>stimuli</code>.
                  </p>
                </div>
              )}
            </div>
            <div
              className={`exam-scrollbar border border-slate-300 bg-white p-5 ${mobile ? "" : "overflow-y-auto overscroll-contain"}`}
            >
              <div className="sticky -top-5 z-10 -mx-5 -mt-5 mb-4 border-b border-slate-200 bg-white/95 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 backdrop-blur">
                Question
              </div>
              {visibleQuestions.map((question) => (
                <article
                  key={question.id}
                  onClick={() => setActiveQuestionId(question.id)}
                  className="mb-7 rounded-xl border border-transparent p-3"
                >
                  <div className="flex gap-3">
                    <strong>{question.number}.</strong>
                    <div className="min-w-0 flex-1">
                      <HtmlFrame html={question.promptHtml} />
                      <div className="mt-3 space-y-2">
                        {question.options.map((option) => (
                          <label
                            key={option.id}
                            className={`flex cursor-pointer items-center gap-3 rounded-sm border px-4 py-3 transition ${answers[question.id] === option.id ? "border-[#2b69a9] bg-blue-50" : "border-slate-200 bg-white hover:border-slate-400"}`}
                          >
                            <input
                              type="radio"
                              name={question.id}
                              checked={answers[question.id] === option.id}
                              className="size-4 accent-[#245f9f]"
                              onChange={() => {
                                setAnswers((current) => ({
                                  ...current,
                                  [question.id]: option.id,
                                }));
                                setActiveQuestionId(question.id);
                              }}
                            />
                            <span>
                              <strong>({option.label})</strong>{" "}
                              <HtmlInline html={option.contentHtml} />
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            </div>
            {section?.kind === "READING" && (
            <div className="grid grid-cols-[1fr_auto_auto] items-center border-t border-slate-300 bg-[#f4f4f4] pl-4">
              <button
                type="button"
                disabled={!activeQuestion}
                onClick={toggleFlag}
                className="flex items-center gap-2 justify-self-start py-3 text-xs font-medium text-slate-700"
              >
                <span
                  className={`grid size-5 place-items-center rounded border ${activeQuestion && flaggedQuestionIds.includes(activeQuestion.id) ? "border-amber-500 bg-amber-500 text-white" : "border-slate-400 bg-white"}`}
                >
                  {activeQuestion && flaggedQuestionIds.includes(activeQuestion.id) ? "✓" : ""}
                </span>
                <span className={mobile ? "sr-only" : ""}>Mark item for review</span>
              </button>
              <button
                type="button"
                onClick={() => setCatalogOpen(true)}
                className="grid h-12 w-12 place-items-center bg-[#07579a] text-lg font-bold text-white"
                aria-label="Mở danh mục câu hỏi"
              >
                ☷
              </button>
              <div className="flex justify-self-end">
                <button
                  type="button"
                  disabled={pageIndex === 0}
                  onClick={() => goToPage(pageIndex - 1)}
                  className="grid h-12 w-12 place-items-center bg-[#55a43b] text-lg font-bold text-white transition disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-100"
                  aria-label="Trang trước"
                >
                  ←
                </button>
                <button
                  type="button"
                  disabled={pageIndex >= pages.length - 1}
                  onClick={() => goToPage(pageIndex + 1)}
                  className="grid h-12 min-w-12 place-items-center bg-[#55a43b] px-3 text-lg font-bold text-white transition disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-100"
                >
                  →
                </button>
              </div>
            </div>
            )}
            {section?.kind === "READING" && catalogOpen && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-[2px] sm:p-4">
                <section className="max-h-[88%] w-full max-w-xl overflow-y-auto rounded-md bg-white p-4 shadow-2xl sm:p-6">
                  <div className="sticky -top-4 z-10 -mx-4 -mt-4 mb-4 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 sm:-top-6 sm:-mx-6 sm:-mt-6 sm:px-6">
                    <div>
                      <h3 className="text-lg font-bold text-[#0d4f8d]">Reading</h3>
                      <p className="text-xs text-slate-500">
                        {readingQuestionCount - answeredCount > 0
                          ? `Bạn còn ${readingQuestionCount - answeredCount} câu chưa trả lời.`
                          : "Bạn đã trả lời tất cả câu hỏi Reading."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCatalogOpen(false)}
                      className="grid size-9 place-items-center rounded-full bg-slate-100 text-xl"
                      aria-label="Đóng danh mục"
                    >
                      ×
                    </button>
                  </div>
                  <div className="mb-5 flex flex-wrap gap-4 text-xs text-slate-600">
                    <span><i className="mr-1 inline-block size-3 rounded bg-[#295ca8]" />Đã làm</span>
                    <span><i className="mr-1 inline-block size-3 rounded border border-slate-300 bg-white" />Chưa làm</span>
                    <span><i className="mr-1 inline-block size-3 rounded border-2 border-amber-500 bg-amber-50" />Đã flag</span>
                  </div>
                  <div className="space-y-5">
                    {test.sections
                      .filter((item) => item.kind === "READING")
                      .map((item) => (
                        <div key={item.id}>
                          <h4 className="mb-2 text-sm font-bold text-slate-700">
                            {item.part?.replace("PART_", "Part ") ?? item.title}
                          </h4>
                          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                            {item.questionGroups.flatMap((itemGroup) =>
                              itemGroup.questions.map((question) => {
                                const targetPageIndex = pages.findIndex(
                                  (candidate) =>
                                    candidate.questions.some(
                                      (candidateQuestion) =>
                                        candidateQuestion.id === question.id,
                                    ),
                                );
                                const answered = Boolean(answers[question.id]);
                                const flagged = flaggedQuestionIds.includes(
                                  question.id,
                                );
                                return (
                                  <button
                                    key={question.id}
                                    type="button"
                                    onClick={() =>
                                      goToPage(targetPageIndex, question.id)
                                    }
                                    className={`relative aspect-square rounded-lg border text-xs font-bold ${answered ? "border-[#295ca8] bg-[#295ca8] text-white" : "border-slate-300 bg-white text-slate-700"} ${activeQuestion?.id === question.id ? "ring-2 ring-slate-900 ring-offset-1" : ""} ${flagged ? "ring-2 ring-amber-500 ring-offset-1" : ""}`}
                                  >
                                    {question.number}
                                    {flagged && (
                                      <span className="absolute -right-1 -top-1 text-[10px] text-amber-600">⚑</span>
                                    )}
                                  </button>
                                );
                              }),
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        ) : (
          <div className="p-10 text-center">No question group selected.</div>
        )}
      </div>
    </div>
  );
}

function ValidationPanel({
  test,
  busy,
  setBusy,
  setError,
  setNotice,
  reload,
}: {
  test: TestTree;
  busy: boolean;
  setBusy: (value: boolean) => void;
  setError: (value: string | null) => void;
  setNotice: (value: string | null) => void;
  reload: () => Promise<void>;
}) {
  const [validation, setValidation] = useState<TestValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const response = await apiFetch(`/admin/tests/${test.id}/validation`);
    if (response.ok) setValidation((await response.json()) as TestValidation);
    else setError(await responseMessage(response));
    setLoading(false);
  }, [setError, test.id]);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);
  async function publish() {
    if (!confirm("Publish snapshot bất biến của đề này?")) return;
    setBusy(true);
    const response = await apiFetch(`/admin/tests/${test.id}/publish`, {
      method: "POST",
    });
    if (response.ok) {
      const payload = (await response.json()) as {
        version: { version: number };
      };
      setNotice(`Đã publish version ${payload.version.version}`);
      await reload();
    } else setError(await responseMessage(response));
    setBusy(false);
  }
  if (loading) return <Empty text="Đang chạy validation…" />;
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="rounded-3xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-accent">
              Pre-publish validation
            </p>
            <h2 className="mt-1 text-2xl font-bold">
              {validation?.valid ? "Sẵn sàng publish" : "Cần hoàn thiện thêm"}
            </h2>
          </div>
          <span
            className={`grid size-12 place-items-center rounded-full text-2xl ${validation?.valid ? "bg-accent-soft text-accent" : "bg-danger-soft text-danger"}`}
          >
            {validation?.valid ? "✓" : "!"}
          </span>
        </div>
        <IssueList title="Errors" items={validation?.errors ?? []} danger />
        <IssueList title="Warnings" items={validation?.warnings ?? []} />
      </section>
      <aside className="h-fit rounded-3xl border border-border bg-surface p-5">
        <h3 className="font-bold">Publish snapshot</h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          Candidate JSON sẽ không chứa đáp án đúng, giải thích hoặc transcript.
          Answer key và review được lưu riêng.
        </p>
        <button
          disabled={busy || !validation?.valid || test.status !== "DRAFT"}
          onClick={() => void publish()}
          className="mt-5 w-full rounded-xl bg-accent px-4 py-3 font-bold text-white disabled:opacity-40 dark:text-slate-950"
        >
          {test.status === "PUBLISHED"
            ? "Đã publish"
            : busy
              ? "Đang upload R2…"
              : "Publish version"}
        </button>
        {test.versions.length > 0 && (
          <div className="mt-4 space-y-2">
            {test.versions.map((version) => (
              <div
                key={version.id}
                className="rounded-xl bg-surface-raised p-3 text-xs"
              >
                <strong>Version {version.version}</strong>
                <span className="ml-2 text-muted">{version.status}</span>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function IssueList({
  title,
  items,
  danger = false,
}: {
  title: string;
  items: Array<{ code: string; path: string; message: string }>;
  danger?: boolean;
}) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-bold">
        {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Không có.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {items.map((item, index) => (
            <div
              key={`${item.code}-${index}`}
              className={`rounded-xl p-3 text-sm ${danger ? "bg-danger-soft text-danger" : "bg-amber-400/10"}`}
            >
              <code className="text-xs font-bold">{item.path}</code>
              <p className="mt-1">{item.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function StimulusPreview({ stimulus }: { stimulus: Stimulus }) {
  if (stimulus.type === "HTML")
    return <HtmlFrame html={stimulus.contentHtml ?? ""} passage />;
  if (stimulus.type === "IMAGE")
    return stimulus.mediaAsset ? (
      <img
        src={stimulus.mediaAsset.url}
        alt={stimulus.altText ?? stimulus.mediaAsset.originalName}
        className="mx-auto max-h-[460px] max-w-full rounded-lg object-contain"
      />
    ) : (
      <p className="rounded-xl bg-amber-400/10 p-3 text-xs text-amber-600">
        {stimulus.altText ?? "[MEDIA_REQUIRED] Chưa gắn ảnh"}
      </p>
    );
  return stimulus.mediaAsset ? (
    <audio controls src={stimulus.mediaAsset.url} className="w-full" />
  ) : (
    <p className="text-xs text-danger">Chưa gắn audio</p>
  );
}
function HtmlFrame({
  html,
  passage = false,
}: {
  html: string;
  passage?: boolean;
}) {
  const plainLength = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ").length;
  const blockCount = (
    html.match(/<(p|div|article|table|tr|li|header|section)\b/gi) ?? []
  ).length;
  const passageHeight = Math.min(
    5000,
    Math.max(260, Math.ceil(plainLength / 55) * 25 + blockCount * 18 + 80),
  );
  const compactHeight = Math.min(
    320,
    Math.max(32, Math.ceil(plainLength / 65) * 24 + blockCount * 10 + 4),
  );
  return (
    <iframe
      sandbox=""
      scrolling="no"
      srcDoc={`<!doctype html><meta charset="utf-8"><style>html,body{overflow:hidden}body{font:15px/1.6 Arial;margin:0;color:#172033}img{max-width:100%}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:6px}</style>${html}`}
      style={{ height: passage ? passageHeight : compactHeight }}
      className="block w-full border-0 bg-white"
      title="HTML content preview"
    />
  );
}
function HtmlInline({ html }: { html: string }) {
  return (
    <span>
      {html
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()}
    </span>
  );
}
function HtmlText({ html }: { html: string }) {
  return (
    <p className="mt-2 line-clamp-2 text-sm text-muted">
      {html
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()}
    </p>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-surface/60 p-14 text-center text-muted">
      {text}
    </div>
  );
}
async function responseMessage(response: Response) {
  const payload = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  if (Array.isArray(payload?.message)) return payload.message.join(", ");
  return payload?.message ?? `Request failed (${response.status})`;
}
