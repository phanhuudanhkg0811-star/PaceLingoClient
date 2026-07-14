"use client";

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/auth-client";
import { ThemeToggle } from "./theme-toggle";

type ImportStatus =
  "PARSED" | "NEEDS_REVIEW" | "VALIDATED" | "PUBLISHED" | "DISCARDED";
type PublishMode = "CREATE_TEST" | "REPLACE_CONTENT" | "APPEND_PARTS";

interface ImportIssue {
  code: string;
  path: string;
  message: string;
}

interface ImportValidation {
  valid: boolean;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  stats: {
    sections: number;
    groups: number;
    questions: number;
    skippedQuestions: number;
  };
}

interface ImportDraft {
  id: string;
  schemaVersion: number;
  externalId: string | null;
  contentHash: string;
  status: ImportStatus;
  sourceJson: unknown;
  normalizedJson: unknown;
  validationJson: ImportValidation;
  targetTest: { id: string; title: string; status: string } | null;
  createdAt: string;
  updatedAt: string;
  duplicate?: boolean;
}

interface TestDraft {
  id: string;
  title: string;
  status: string;
  totalQuestions: number;
}

const initialJson = `{
  "schemaVersion": 1,
  "externalId": "my-toeic-import",
  "test": {
    "title": "TOEIC Practice Test",
    "type": "FULL_TEST",
    "durationMinutes": 120
  },
  "sections": []
}`;

export function JsonImportWorkbench() {
  const [sourceText, setSourceText] = useState(initialJson);
  const [current, setCurrent] = useState<ImportDraft | null>(null);
  const [history, setHistory] = useState<ImportDraft[]>([]);
  const [tests, setTests] = useState<TestDraft[]>([]);
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [publishMode, setPublishMode] = useState<PublishMode>("CREATE_TEST");
  const [targetTestId, setTargetTestId] = useState("");
  const [showNormalized, setShowNormalized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadSidebar = useCallback(async () => {
    try {
      const [importsResponse, testsResponse] = await Promise.all([
        apiFetch("/admin/imports?page=1&pageSize=20"),
        apiFetch("/admin/tests"),
      ]);
      if (!importsResponse.ok)
        throw new Error(await responseMessage(importsResponse));
      if (!testsResponse.ok)
        throw new Error(await responseMessage(testsResponse));
      const importsPayload = (await importsResponse.json()) as {
        items: ImportDraft[];
      };
      setHistory(importsPayload.items);
      setTests((await testsResponse.json()) as TestDraft[]);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Không thể tải dữ liệu import",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadSidebar());
  }, [loadSidebar]);

  const validation = current?.validationJson;
  const canEdit =
    current && !["PUBLISHED", "DISCARDED"].includes(current.status);
  const canPublish = current?.status === "VALIDATED" && validation?.valid;
  const allIssues = useMemo(
    () => [
      ...(validation?.errors.map((item) => ({
        ...item,
        level: "error" as const,
      })) ?? []),
      ...(validation?.warnings.map((item) => ({
        ...item,
        level: "warning" as const,
      })) ?? []),
    ],
    [validation],
  );

  function newImport() {
    setCurrent(null);
    setSourceText(initialJson);
    setError(null);
    setNotice(null);
    setShowNormalized(false);
  }

  async function openDraft(draft: ImportDraft) {
    setBusy(true);
    try {
      const response = await apiFetch(`/admin/imports/${draft.id}`);
      if (!response.ok) throw new Error(await responseMessage(response));
      const payload = (await response.json()) as ImportDraft;
      setCurrent(payload);
      setSourceText(JSON.stringify(payload.sourceJson, null, 2));
      setTargetTestId(payload.targetTest?.id ?? "");
      setNotice(null);
      setError(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể mở import draft",
      );
    } finally {
      setBusy(false);
    }
  }

  async function parseOrUpdate() {
    let source: unknown;
    try {
      source = JSON.parse(sourceText) as unknown;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? `JSON syntax: ${reason.message}`
          : "JSON không hợp lệ",
      );
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetch(
        canEdit ? `/admin/imports/${current.id}` : "/admin/imports/parse",
        {
          method: canEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, skipInvalidQuestions: skipInvalid }),
        },
      );
      if (!response.ok) throw new Error(await responseMessage(response));
      const payload = (await response.json()) as ImportDraft;
      setCurrent(payload);
      setSourceText(JSON.stringify(payload.sourceJson, null, 2));
      setNotice(
        payload.duplicate
          ? "JSON này đã được import trước đó; đã mở bản cũ."
          : payload.status === "VALIDATED"
            ? "Parse thành công, dữ liệu đã sẵn sàng tạo Test Draft."
            : "Đã lưu Import Draft. Sửa các lỗi bên dưới rồi validate lại.",
      );
      await loadSidebar();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể parse JSON",
      );
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!current) return;
    if (publishMode !== "CREATE_TEST" && !targetTestId) {
      setError("Hãy chọn đề đích");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch(`/admin/imports/${current.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: publishMode,
          targetTestId: targetTestId || undefined,
        }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const payload = (await response.json()) as {
        importDraft: ImportDraft;
        test: TestDraft;
        duplicate: boolean;
      };
      setCurrent(payload.importDraft);
      setTargetTestId(payload.test.id);
      setNotice(
        payload.duplicate
          ? `Import này đã tạo đề “${payload.test.title}” trước đó.`
          : `Đã chuyển dữ liệu vào Test Draft “${payload.test.title}”.`,
      );
      await loadSidebar();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể tạo Test Draft",
      );
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    if (!current || !window.confirm("Bỏ Import Draft này?")) return;
    setBusy(true);
    try {
      const response = await apiFetch(`/admin/imports/${current.id}/discard`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      setCurrent((await response.json()) as ImportDraft);
      setNotice("Import Draft đã được bỏ.");
      await loadSidebar();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể bỏ Import Draft",
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      setError("Chỉ hỗ trợ file .json");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("File JSON tối đa 8 MB");
      return;
    }
    setSourceText(await file.text());
    setCurrent(null);
    setNotice(`Đã đọc ${file.name}. Nhấn Parse & validate để tiếp tục.`);
    setError(null);
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <Link
              href="/admin"
              className="text-sm font-semibold text-accent hover:text-accent-strong"
            >
              ← Trung tâm quản trị
            </Link>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-accent">
              Content pipeline
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">
              Import đề từ JSON
            </h1>
            <p className="mt-3 max-w-3xl leading-7 text-muted">
              Dán JSON từ công cụ chuyển đổi, kiểm tra từng đường dẫn lỗi và chỉ
              đưa dữ liệu sạch vào Test Draft.
            </p>
          </div>
          <ThemeToggle />
        </header>

        {(error || notice) && (
          <div
            className={`mt-6 flex items-start justify-between gap-4 rounded-2xl px-5 py-4 text-sm ${error ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent-strong"}`}
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

        <section className="mt-7 grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_390px]">
          <aside className="h-fit rounded-3xl border border-border bg-surface p-4 shadow-[0_16px_45px_rgba(var(--shadow),0.06)] xl:sticky xl:top-6">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Import gần đây</h2>
              <button
                onClick={newImport}
                className="rounded-lg bg-accent-soft px-2.5 py-1.5 text-xs font-bold text-accent-strong"
              >
                + Mới
              </button>
            </div>
            <div className="mt-4 max-h-[70vh] space-y-2 overflow-auto pr-1">
              {loading ? (
                <div className="h-32 animate-pulse rounded-2xl bg-surface-raised" />
              ) : history.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted">
                  Chưa có import nào.
                </p>
              ) : (
                history.map((draft) => (
                  <button
                    key={draft.id}
                    onClick={() => void openDraft(draft)}
                    className={`w-full rounded-2xl border p-3 text-left transition hover:border-accent/50 ${current?.id === draft.id ? "border-accent bg-accent-soft/50" : "border-border bg-background"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={draft.status} />
                      <span className="text-[10px] text-muted">
                        v{draft.schemaVersion}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold">
                      {importTitle(draft)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted">
                      {new Date(draft.updatedAt).toLocaleString("vi-VN")}
                    </p>
                  </button>
                ))
              )}
            </div>
          </aside>

          <div className="min-w-0">
            <div className="rounded-3xl border border-border bg-surface shadow-[0_16px_45px_rgba(var(--shadow),0.06)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                  <h2 className="font-bold">JSON source</h2>
                  <p className="mt-1 text-xs text-muted">
                    Schema v1 · tối đa 8 MB
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  <a
                    href="/samples/toeic-import-v1.json"
                    download
                    className="rounded-lg border border-border px-3 py-2 hover:border-accent"
                  >
                    Tải JSON mẫu
                  </a>
                  <label className="cursor-pointer rounded-lg border border-border px-3 py-2 hover:border-accent">
                    Upload .json
                    <input
                      type="file"
                      accept="application/json,.json"
                      onChange={(event) => void loadFile(event)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              <textarea
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                spellCheck={false}
                disabled={Boolean(current && !canEdit)}
                className="min-h-[590px] w-full resize-y bg-[#0b1220] p-5 font-mono text-[13px] leading-6 text-slate-200 outline-none disabled:opacity-70"
              />
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-5 py-4">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={skipInvalid}
                    onChange={(event) => setSkipInvalid(event.target.checked)}
                    disabled={Boolean(current && !canEdit)}
                    className="mt-1"
                  />
                  <span>
                    <strong>Bỏ qua câu lỗi</strong>
                    <span className="block text-xs text-muted">
                      Câu lỗi bị loại và chuyển thành warning.
                    </span>
                  </span>
                </label>
                <button
                  disabled={busy || Boolean(current && !canEdit)}
                  onClick={() => void parseOrUpdate()}
                  className="rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white hover:bg-accent-strong disabled:opacity-40 dark:text-slate-950"
                >
                  {busy
                    ? "Đang xử lý…"
                    : canEdit
                      ? "Lưu & validate lại"
                      : "Parse & validate"}
                </button>
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <section className="rounded-3xl border border-border bg-surface p-5 shadow-[0_16px_45px_rgba(var(--shadow),0.06)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-accent">
                    Validation
                  </p>
                  <h2 className="mt-1 text-xl font-bold">Kết quả import</h2>
                </div>
                {current && <StatusBadge status={current.status} />}
              </div>
              {!current ? (
                <p className="mt-5 text-sm leading-6 text-muted">
                  Paste hoặc upload JSON, sau đó nhấn Parse để tạo Import Draft.
                </p>
              ) : (
                <>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <Stat
                      value={validation?.stats.sections ?? 0}
                      label="Sections"
                    />
                    <Stat
                      value={validation?.stats.groups ?? 0}
                      label="Groups"
                    />
                    <Stat
                      value={validation?.stats.questions ?? 0}
                      label="Questions"
                    />
                  </div>
                  {allIssues.length === 0 ? (
                    <div className="mt-4 rounded-2xl bg-accent-soft p-4 text-sm font-semibold text-accent-strong">
                      ✓ Schema cơ bản hợp lệ. Media và timeline có thể thêm ở
                      bước biên tập đề.
                    </div>
                  ) : (
                    <div className="mt-4 max-h-80 space-y-2 overflow-auto">
                      {allIssues.map((item, index) => (
                        <button
                          key={`${item.code}-${item.path}-${index}`}
                          onClick={() =>
                            document.querySelector("textarea")?.focus()
                          }
                          className={`w-full rounded-xl border p-3 text-left text-xs ${item.level === "error" ? "border-red-400/30 bg-danger-soft" : "border-amber-400/30 bg-amber-400/10"}`}
                        >
                          <span className="font-mono font-bold">
                            {item.path}
                          </span>
                          <span className="mt-1 block leading-5">
                            {item.message}
                          </span>
                          <span className="mt-1 block text-[10px] opacity-60">
                            {item.code}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setShowNormalized((value) => !value)}
                    className="mt-4 text-xs font-bold text-accent hover:text-accent-strong"
                  >
                    {showNormalized
                      ? "Ẩn normalized JSON"
                      : "Xem normalized JSON"}
                  </button>
                  {showNormalized && (
                    <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-[#0b1220] p-3 text-[10px] leading-5 text-slate-200">
                      {JSON.stringify(current.normalizedJson, null, 2)}
                    </pre>
                  )}
                </>
              )}
            </section>

            {current && (
              <section className="rounded-3xl border border-border bg-surface p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-accent">
                  Create Test Draft
                </p>
                <select
                  value={publishMode}
                  onChange={(event) =>
                    setPublishMode(event.target.value as PublishMode)
                  }
                  disabled={current.status === "PUBLISHED"}
                  className="mt-4 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground"
                >
                  <option value="CREATE_TEST">Tạo đề mới</option>
                  <option value="APPEND_PARTS">
                    Thêm Part vào đề đang sửa
                  </option>
                  <option value="REPLACE_CONTENT">
                    Thay nội dung đề đang sửa
                  </option>
                </select>
                {publishMode !== "CREATE_TEST" && (
                  <select
                    value={targetTestId}
                    onChange={(event) => setTargetTestId(event.target.value)}
                    className="mt-3 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground"
                  >
                    <option value="">Chọn đề đích…</option>
                    {tests
                      .filter((test) => test.status === "DRAFT")
                      .map((test) => (
                        <option key={test.id} value={test.id}>
                          {test.title} · {test.totalQuestions} câu
                        </option>
                      ))}
                  </select>
                )}
                <button
                  disabled={busy || !canPublish}
                  onClick={() => void publish()}
                  className="mt-4 w-full rounded-xl bg-accent px-4 py-3 font-bold text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-950"
                >
                  {current.status === "PUBLISHED"
                    ? "Đã tạo Test Draft"
                    : "Đưa vào Test Draft"}
                </button>
                {canEdit && (
                  <button
                    disabled={busy}
                    onClick={() => void discard()}
                    className="mt-2 w-full rounded-xl px-4 py-2 text-sm font-semibold text-danger hover:bg-danger-soft"
                  >
                    Bỏ import này
                  </button>
                )}
                {!canPublish && canEdit && (
                  <p className="mt-3 text-xs leading-5 text-muted">
                    Cần sửa hết error hoặc bật “Bỏ qua câu lỗi” rồi validate
                    lại.
                  </p>
                )}
                {current.targetTest && (
                  <p className="mt-3 rounded-xl bg-surface-raised p-3 text-xs">
                    Đề đích: <strong>{current.targetTest.title}</strong>
                  </p>
                )}
              </section>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: ImportStatus }) {
  const styles: Record<ImportStatus, string> = {
    PARSED: "bg-slate-500/15 text-muted",
    NEEDS_REVIEW: "bg-amber-400/15 text-amber-600 dark:text-amber-300",
    VALIDATED: "bg-accent-soft text-accent-strong",
    PUBLISHED: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
    DISCARDED: "bg-danger-soft text-danger",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-black tracking-wide ${styles[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-surface-raised p-3 text-center">
      <strong className="block text-xl">{value}</strong>
      <span className="mt-1 block text-[10px] uppercase tracking-wide text-muted">
        {label}
      </span>
    </div>
  );
}

function importTitle(draft: ImportDraft) {
  const normalized = draft.normalizedJson as { title?: string } | null;
  return normalized?.title ?? draft.externalId ?? "Untitled import";
}

async function responseMessage(response: Response) {
  const payload = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  if (Array.isArray(payload?.message)) return payload.message.join(", ");
  return payload?.message ?? `Request failed (${response.status})`;
}
