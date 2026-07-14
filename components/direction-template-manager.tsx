"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/auth-client";
import { ThemeToggle } from "./theme-toggle";

const parts = [
  "PART_1",
  "PART_2",
  "PART_3",
  "PART_4",
  "PART_5",
  "PART_6",
  "PART_7",
] as const;
type ToeicPart = (typeof parts)[number];

interface AudioAsset {
  id: string;
  originalName: string;
  url: string;
  durationMs: number | null;
}

interface DirectionTemplate {
  id: string;
  part: ToeicPart;
  directionText: string;
  directionAudioAssetId: string | null;
  directionAudioAsset: AudioAsset | null;
  exampleHtml: string | null;
  exampleAudioAssetId: string | null;
  exampleAudioAsset: AudioAsset | null;
  version: number;
  language: string;
  isDefault: boolean;
  createdAt: string;
  _count: { sections: number };
}

interface FormState {
  directionText: string;
  directionAudioAssetId: string;
  exampleHtml: string;
  exampleAudioAssetId: string;
  isDefault: boolean;
}

const emptyForm: FormState = {
  directionText: "",
  directionAudioAssetId: "",
  exampleHtml: "",
  exampleAudioAssetId: "",
  isDefault: false,
};

export function DirectionTemplateManager() {
  const [selectedPart, setSelectedPart] = useState<ToeicPart>("PART_1");
  const [language, setLanguage] = useState("en");
  const [templates, setTemplates] = useState<DirectionTemplate[]>([]);
  const [audioAssets, setAudioAssets] = useState<AudioAsset[]>([]);
  const [editing, setEditing] = useState<DirectionTemplate | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [directionsResponse, mediaResponse] = await Promise.all([
        apiFetch(`/admin/directions?language=${encodeURIComponent(language)}`),
        apiFetch("/admin/media?type=AUDIO&page=1&pageSize=50"),
      ]);
      if (!directionsResponse.ok)
        throw new Error(await responseMessage(directionsResponse));
      if (!mediaResponse.ok)
        throw new Error(await responseMessage(mediaResponse));
      setTemplates((await directionsResponse.json()) as DirectionTemplate[]);
      const media = (await mediaResponse.json()) as { items: AudioAsset[] };
      setAudioAssets(media.items);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể tải Direction Templates",
      );
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const partTemplates = useMemo(
    () => templates.filter((template) => template.part === selectedPart),
    [selectedPart, templates],
  );

  const counts = useMemo(
    () =>
      Object.fromEntries(
        parts.map((part) => [
          part,
          templates.filter((item) => item.part === part).length,
        ]),
      ),
    [templates],
  );

  function startCreate(source?: DirectionTemplate) {
    setEditing(null);
    setForm(
      source
        ? {
            directionText: source.directionText,
            directionAudioAssetId: source.directionAudioAssetId ?? "",
            exampleHtml: source.exampleHtml ?? "",
            exampleAudioAssetId: source.exampleAudioAssetId ?? "",
            isDefault: false,
          }
        : emptyForm,
    );
    document
      .getElementById("direction-editor")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startEdit(template: DirectionTemplate) {
    setEditing(template);
    setForm({
      directionText: template.directionText,
      directionAudioAssetId: template.directionAudioAssetId ?? "",
      exampleHtml: template.exampleHtml ?? "",
      exampleAudioAssetId: template.exampleAudioAssetId ?? "",
      isDefault: template.isDefault,
    });
    document
      .getElementById("direction-editor")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = editing
        ? {
            directionText: form.directionText,
            directionAudioAssetId: form.directionAudioAssetId || null,
            exampleHtml: form.exampleHtml || null,
            exampleAudioAssetId: form.exampleAudioAssetId || null,
          }
        : { ...form, part: selectedPart, language };
      const response = await apiFetch(
        editing ? `/admin/directions/${editing.id}` : "/admin/directions",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      setEditing(null);
      setForm(emptyForm);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể lưu template",
      );
    } finally {
      setBusy(false);
    }
  }

  async function setDefault(template: DirectionTemplate) {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/admin/directions/${template.id}/default`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể đổi template mặc định",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(template: DirectionTemplate) {
    if (
      !window.confirm(
        `Xóa Direction Part ${partNumber(template.part)} v${template.version}?`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch(`/admin/directions/${template.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể xóa template",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <Link
              href="/admin"
              className="text-sm font-semibold text-accent hover:text-accent-strong"
            >
              ← Trung tâm quản trị
            </Link>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-accent">
              Test fidelity
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">
              Direction Templates
            </h1>
            <p className="mt-3 max-w-3xl leading-7 text-muted">
              Quản lý phần hướng dẫn độc lập với câu hỏi. Mock test luôn phát
              Directions; practice mode có thể linh hoạt hơn.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold">
              <span className="mr-2 text-muted">Ngôn ngữ</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="bg-transparent text-foreground"
              >
                <option value="en">English</option>
                <option value="vi">Tiếng Việt</option>
              </select>
            </label>
            <ThemeToggle />
          </div>
        </header>

        <section className="mt-8 grid gap-3 rounded-3xl border border-border bg-surface p-3 shadow-[0_18px_50px_rgba(var(--shadow),0.08)] sm:grid-cols-3 lg:grid-cols-7">
          {parts.map((part) => (
            <button
              key={part}
              type="button"
              onClick={() => {
                setSelectedPart(part);
                setEditing(null);
                setForm(emptyForm);
              }}
              className={`rounded-2xl px-3 py-4 text-left transition ${selectedPart === part ? "bg-accent text-white shadow-lg dark:text-slate-950" : "hover:bg-surface-raised"}`}
            >
              <span className="block text-xs font-bold uppercase opacity-70">
                Part
              </span>
              <span className="mt-1 block text-2xl font-black">
                {partNumber(part)}
              </span>
              <span className="mt-2 block text-xs opacity-75">
                {counts[part] ?? 0} phiên bản
              </span>
            </button>
          ))}
        </section>

        {error && (
          <div className="mt-6 flex justify-between gap-4 rounded-2xl bg-danger-soft px-5 py-4 text-sm text-danger">
            <span>{error}</span>
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        <section className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-accent">
                  TOEIC Part {partNumber(selectedPart)}
                </p>
                <h2 className="mt-1 text-2xl font-bold">Các phiên bản</h2>
              </div>
              <button
                onClick={() => startCreate()}
                className="rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white hover:bg-accent-strong dark:text-slate-950"
              >
                + Template mới
              </button>
            </div>

            {loading ? (
              <div className="mt-5 h-72 animate-pulse rounded-3xl border border-border bg-surface" />
            ) : partTemplates.length === 0 ? (
              <div className="mt-5 rounded-3xl border border-dashed border-border bg-surface/60 px-6 py-14 text-center text-muted">
                Chưa có Direction cho Part này. Tạo phiên bản đầu tiên và đặt
                làm mặc định.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {partTemplates.map((template) => (
                  <article
                    key={template.id}
                    className={`rounded-3xl border bg-surface p-5 shadow-[0_14px_40px_rgba(var(--shadow),0.06)] ${template.isDefault ? "border-accent/60" : "border-border"}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-11 place-items-center rounded-2xl bg-accent-soft font-black text-accent-strong">
                          v{template.version}
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold">
                              Direction · Part {partNumber(template.part)}
                            </h3>
                            {template.isDefault && (
                              <span className="rounded-full bg-accent-soft px-2 py-1 text-[10px] font-black uppercase tracking-wider text-accent-strong">
                                Mặc định
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted">
                            Dùng ở {template._count.sections} section ·{" "}
                            {template.language.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-bold">
                        {!template.isDefault && (
                          <button
                            disabled={busy}
                            onClick={() => void setDefault(template)}
                            className="rounded-lg border border-border px-3 py-2 hover:border-accent"
                          >
                            Đặt mặc định
                          </button>
                        )}
                        <button
                          onClick={() => startCreate(template)}
                          className="rounded-lg border border-border px-3 py-2 hover:border-accent"
                        >
                          Tạo bản mới
                        </button>
                        <button
                          onClick={() => startEdit(template)}
                          className="rounded-lg border border-border px-3 py-2 hover:border-accent"
                        >
                          Sửa
                        </button>
                        <button
                          disabled={
                            busy ||
                            template.isDefault ||
                            template._count.sections > 0
                          }
                          onClick={() => void remove(template)}
                          className="rounded-lg px-3 py-2 text-danger hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                    <p className="mt-5 whitespace-pre-line rounded-2xl bg-surface-raised px-4 py-4 text-sm leading-7">
                      {template.directionText}
                    </p>
                    {(template.directionAudioAsset ||
                      template.exampleAudioAsset) && (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <AudioPreview
                          label="Direction audio"
                          asset={template.directionAudioAsset}
                        />
                        <AudioPreview
                          label="Example audio"
                          asset={template.exampleAudioAsset}
                        />
                      </div>
                    )}
                    {template.exampleHtml && (
                      <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted">
                        <strong className="text-foreground">Example:</strong>{" "}
                        {stripHtml(template.exampleHtml)}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-5">
            <form
              id="direction-editor"
              onSubmit={submit}
              className="rounded-3xl border border-border bg-surface p-5 shadow-[0_18px_50px_rgba(var(--shadow),0.08)] xl:sticky xl:top-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-accent">
                    Part {partNumber(selectedPart)}
                  </p>
                  <h2 className="mt-1 text-xl font-bold">
                    {editing
                      ? `Sửa phiên bản ${editing.version}`
                      : "Tạo phiên bản mới"}
                  </h2>
                </div>
                {editing && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setForm(emptyForm);
                    }}
                    className="text-sm text-muted hover:text-foreground"
                  >
                    Hủy
                  </button>
                )}
              </div>
              <label className="mt-5 block text-sm font-semibold">
                Direction text
                <textarea
                  required
                  rows={7}
                  value={form.directionText}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      directionText: event.target.value,
                    }))
                  }
                  className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 font-normal leading-6 text-foreground"
                  placeholder="Instructions shown before this part…"
                />
              </label>
              <AudioSelect
                label="Direction audio"
                value={form.directionAudioAssetId}
                assets={audioAssets}
                onChange={(value) =>
                  setForm((state) => ({
                    ...state,
                    directionAudioAssetId: value,
                  }))
                }
              />
              <label className="mt-4 block text-sm font-semibold">
                Example HTML
                <textarea
                  rows={4}
                  value={form.exampleHtml}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      exampleHtml: event.target.value,
                    }))
                  }
                  className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 font-mono text-xs leading-6 text-foreground"
                  placeholder="<p>Optional example…</p>"
                />
              </label>
              <AudioSelect
                label="Example audio"
                value={form.exampleAudioAssetId}
                assets={audioAssets}
                onChange={(value) =>
                  setForm((state) => ({ ...state, exampleAudioAssetId: value }))
                }
              />
              {!editing && (
                <label className="mt-5 flex items-start gap-3 rounded-xl bg-accent-soft/60 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(event) =>
                      setForm((value) => ({
                        ...value,
                        isDefault: event.target.checked,
                      }))
                    }
                    className="mt-1"
                  />
                  <span>
                    <strong>Đặt làm mặc định</strong>
                    <span className="mt-1 block text-xs text-muted">
                      Các đề không khai báo Directions sẽ tự dùng bản này.
                    </span>
                  </span>
                </label>
              )}
              <button
                disabled={busy}
                className="mt-5 w-full rounded-xl bg-accent px-4 py-3 font-bold text-white hover:bg-accent-strong disabled:opacity-50 dark:text-slate-950"
              >
                {busy
                  ? "Đang lưu…"
                  : editing
                    ? "Lưu thay đổi"
                    : "Tạo phiên bản"}
              </button>
            </form>

            <div className="rounded-3xl border border-border bg-surface p-5 text-sm leading-6">
              <h3 className="font-bold">Quy tắc khi làm bài</h3>
              <dl className="mt-4 space-y-3">
                <Rule
                  term="DEFAULT"
                  text="Tự lấy template mặc định đúng Part và ngôn ngữ."
                />
                <Rule term="CUSTOM" text="Khóa đề vào một phiên bản cụ thể." />
                <Rule
                  term="NONE"
                  text="Chỉ dành cho practice; mock test nghiêm túc không được bỏ qua."
                />
              </dl>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function AudioSelect({
  label,
  value,
  assets,
  onChange,
}: {
  label: string;
  value: string;
  assets: AudioAsset[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="mt-4 block text-sm font-semibold">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 font-normal text-foreground"
      >
        <option value="">Không dùng audio riêng</option>
        {assets.map((asset) => (
          <option key={asset.id} value={asset.id}>
            {asset.originalName}
          </option>
        ))}
      </select>
    </label>
  );
}

function AudioPreview({
  label,
  asset,
}: {
  label: string;
  asset: AudioAsset | null;
}) {
  if (!asset) return null;
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="truncate text-xs font-bold" title={asset.originalName}>
        {label} · {asset.originalName}
      </p>
      <audio controls preload="metadata" className="mt-2 h-8 w-full">
        <source src={asset.url} />
      </audio>
    </div>
  );
}

function Rule({ term, text }: { term: string; text: string }) {
  return (
    <div className="grid grid-cols-[76px_1fr] gap-3">
      <dt className="font-black text-accent-strong">{term}</dt>
      <dd className="text-muted">{text}</dd>
    </div>
  );
}

function partNumber(part: ToeicPart) {
  return part.replace("PART_", "");
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function responseMessage(response: Response) {
  const payload = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  if (Array.isArray(payload?.message)) return payload.message.join(", ");
  return payload?.message ?? `Request failed (${response.status})`;
}
