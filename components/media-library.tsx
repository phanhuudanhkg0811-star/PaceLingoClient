"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/auth-client";
import { ThemeToggle } from "./theme-toggle";

type MediaType = "IMAGE" | "AUDIO";

interface MediaAsset {
  id: string;
  type: MediaType;
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  altText: string | null;
  folder: { id: string; name: string } | null;
  createdAt: string;
  _count: Record<string, number>;
}

interface MediaFolder {
  id: string;
  name: string;
  _count: { assets: number };
}

interface MediaListResponse {
  items: MediaAsset[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  storageConfigured: boolean;
}

interface UsageDetails {
  id: string;
  originalName: string;
  fullListeningTests: Array<{ id: string; title: string }>;
  stimulusItems: Array<{ id: string; group: { id: string; title: string | null } }>;
  directionAudioTemplates: Array<{ id: string; part: string; version: number }>;
  exampleAudioTemplates: Array<{ id: string; part: string; version: number }>;
  questionAudioSegments: Array<{ id: string; questionId: string; segmentType: string }>;
}

interface UploadProgress {
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
}

export function MediaLibrary() {
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [pagination, setPagination] = useState<MediaListResponse["pagination"]>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [storageConfigured, setStorageConfigured] = useState(true);
  const [type, setType] = useState<"" | MediaType>("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedFolder, setSelectedFolder] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageDetails | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null,
  );
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (type) query.set("type", type);
      if (search) query.set("search", search);
      if (selectedFolder !== "all") query.set("folder", selectedFolder);
      const response = await apiFetch(`/admin/media?${query}`);
      if (!response.ok) throw new Error(await responseMessage(response));
      const payload = (await response.json()) as MediaListResponse;
      setItems(payload.items);
      setPagination(payload.pagination);
      setStorageConfigured(payload.storageConfigured);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải thư viện media");
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedFolder, type]);

  const loadFolders = useCallback(async () => {
    try {
      const response = await apiFetch("/admin/media/folders");
      if (!response.ok) throw new Error(await responseMessage(response));
      setFolders((await response.json()) as MediaFolder[]);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể tải thư mục",
      );
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadMedia());
  }, [loadMedia]);

  useEffect(() => {
    queueMicrotask(() => void loadFolders());
  }, [loadFolders]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement | null;
    const files = Array.from(fileInput?.files ?? []).filter(
      (file) => file.size > 0,
    );
    if (!files.length) {
      setError("Hãy chọn ít nhất một file ảnh hoặc audio");
      return;
    }
    const values = new FormData(form);
    const altText = String(values.get("altText") ?? "").trim();
    const folderId = String(values.get("folderId") ?? "").trim();
    setBusy(true);
    setError(null);
    setUploadNotice(null);
    setUploadProgress({
      total: files.length,
      completed: 0,
      succeeded: 0,
      failed: 0,
    });
    try {
      const results = await uploadFilesConcurrently(files, 3, async (file) => {
        try {
          const data = new FormData();
          data.set("file", file);
          if (altText) data.set("altText", altText);
          if (folderId) data.set("folderId", folderId);
          const response = await apiFetch("/admin/media", {
            method: "POST",
            body: data,
          });
          if (!response.ok) throw new Error(await responseMessage(response));
          setUploadProgress((current) =>
            current
              ? {
                  ...current,
                  completed: current.completed + 1,
                  succeeded: current.succeeded + 1,
                }
              : current,
          );
          return { file, error: null };
        } catch (reason) {
          const message =
            reason instanceof Error ? reason.message : "Upload thất bại";
          setUploadProgress((current) =>
            current
              ? {
                  ...current,
                  completed: current.completed + 1,
                  failed: current.failed + 1,
                }
              : current,
          );
          return { file, error: message };
        }
      });
      const failures = results.filter((result) => result.error);
      const successCount = results.length - failures.length;
      form.reset();
      setSelectedFiles([]);
      setPage(1);
      if (successCount > 0) {
        await Promise.all([loadMedia(), loadFolders()]);
      }
      if (failures.length) {
        const details = failures
          .slice(0, 5)
          .map((result) => `${result.file.name}: ${result.error}`)
          .join("; ");
        setError(
          `Đã upload ${successCount}/${results.length} file. File lỗi: ${details}${failures.length > 5 ? ` và ${failures.length - 5} file khác` : ""}`,
        );
      } else {
        setUploadNotice(`Đã upload thành công ${successCount} file lên R2.`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Upload thất bại");
    } finally {
      setBusy(false);
      setUploadProgress(null);
    }
  }

  async function remove(media: MediaAsset) {
    if (!window.confirm(`Xóa “${media.originalName}”?`)) return;
    setBusy(true);
    try {
      const response = await apiFetch(`/admin/media/${media.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseMessage(response));
      await Promise.all([loadMedia(), loadFolders()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xóa media");
    } finally {
      setBusy(false);
    }
  }

  async function updateAltText(media: MediaAsset, altText: string) {
    setBusy(true);
    try {
      const response = await apiFetch(`/admin/media/${media.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ altText: altText || null }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      await loadMedia();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể lưu mô tả");
    } finally {
      setBusy(false);
    }
  }

  async function moveToFolder(media: MediaAsset, folderId: string | null) {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch(`/admin/media/${media.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      await Promise.all([loadMedia(), loadFolders()]);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể chuyển thư mục",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createFolder() {
    const name = window.prompt("Tên thư mục mới:")?.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch("/admin/media/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const folder = (await response.json()) as MediaFolder;
      await loadFolders();
      setSelectedFolder(folder.id);
      setPage(1);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể tạo thư mục",
      );
    } finally {
      setBusy(false);
    }
  }

  async function renameFolder(folder: MediaFolder) {
    const name = window.prompt("Đổi tên thư mục:", folder.name)?.trim();
    if (!name || name === folder.name) return;
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch(`/admin/media/folders/${folder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      await loadFolders();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể đổi tên thư mục",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeFolder(folder: MediaFolder) {
    if (
      !window.confirm(
        `Xóa thư mục “${folder.name}”? ${folder._count.assets} file bên trong sẽ chuyển về Chưa phân loại.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch(`/admin/media/folders/${folder.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      if (selectedFolder === folder.id) setSelectedFolder("unfiled");
      setPage(1);
      await Promise.all([loadFolders(), loadMedia()]);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không thể xóa thư mục",
      );
    } finally {
      setBusy(false);
    }
  }

  async function replace(media: MediaAsset, file: File) {
    const data = new FormData();
    data.set("file", file);
    setBusy(true);
    try {
      const response = await apiFetch(`/admin/media/${media.id}/replace`, {
        method: "POST",
        body: data,
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      await loadMedia();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể thay media");
    } finally {
      setBusy(false);
    }
  }

  async function showUsages(media: MediaAsset) {
    const response = await apiFetch(`/admin/media/${media.id}/usages`);
    if (!response.ok) {
      setError(await responseMessage(response));
      return;
    }
    setUsage((await response.json()) as UsageDetails);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <Link href="/admin" className="text-sm font-semibold text-accent hover:text-accent-strong">
              ← Trung tâm quản trị
            </Link>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-accent">Media storage</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">Thư viện Media</h1>
            <p className="mt-3 max-w-2xl leading-7 text-muted">
              Một nơi cho toàn bộ ảnh, passage và audio của đề thi TOEIC.
            </p>
          </div>
          <ThemeToggle />
        </header>

        {!storageConfigured && (
          <div className="mt-8 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-5 py-4 text-sm">
            R2 chưa được cấu hình. Bạn vẫn xem được dữ liệu hiện có, nhưng chưa thể upload.
          </div>
        )}

        {error && (
          <div className="mt-6 flex items-start justify-between gap-4 rounded-2xl bg-danger-soft px-5 py-4 text-sm text-danger">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="Đóng thông báo">×</button>
          </div>
        )}

        {uploadNotice && (
          <div className="mt-6 flex items-start justify-between gap-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-4 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            <span>{uploadNotice}</span>
            <button
              type="button"
              onClick={() => setUploadNotice(null)}
              aria-label="Đóng thông báo"
            >
              ×
            </button>
          </div>
        )}

        <section className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
          <form
            onSubmit={upload}
            className="h-fit rounded-3xl border border-border bg-surface p-5 shadow-[0_18px_50px_rgba(var(--shadow),0.08)] lg:sticky lg:top-6"
          >
            <h2 className="text-lg font-bold">Upload nhiều tài nguyên</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Chọn nhiều JPEG, PNG, WebP, GIF, MP3, WAV, OGG hoặc M4A cùng lúc.
            </p>
            <label className="mt-5 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-accent/50 bg-accent-soft/60 px-4 text-center transition hover:border-accent">
              <span className="text-3xl text-accent">↑</span>
              <span className="mt-3 text-sm font-bold">Chọn ảnh hoặc audio</span>
              <span className="mt-1 text-xs text-muted">
                Giữ Ctrl/Shift để chọn hàng loạt
              </span>
              <input
                name="file"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif,audio/mpeg,audio/wav,audio/ogg,audio/mp4"
                onChange={(event) =>
                  setSelectedFiles(Array.from(event.target.files ?? []))
                }
                className="mt-3 max-w-full text-xs text-muted"
              />
            </label>
            {selectedFiles.length > 0 && (
              <div className="mt-3 rounded-xl border border-border bg-background p-3 text-xs">
                <div className="flex items-center justify-between gap-3 font-bold">
                  <span>{selectedFiles.length} file đã chọn</span>
                  <span className="text-muted">
                    {formatBatchBytes(selectedFiles)}
                  </span>
                </div>
                <ul className="mt-2 space-y-1 text-muted">
                  {selectedFiles.slice(0, 5).map((file) => (
                    <li key={`${file.name}-${file.size}`} className="truncate">
                      {file.name}
                    </li>
                  ))}
                  {selectedFiles.length > 5 && (
                    <li>…và {selectedFiles.length - 5} file khác</li>
                  )}
                </ul>
              </div>
            )}
            <label className="mt-5 block text-sm font-semibold">
              Alt text / mô tả
              <input
                name="altText"
                placeholder="Ví dụ: Nhân viên đang họp trong văn phòng"
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 font-normal text-foreground placeholder:text-muted/70"
              />
            </label>
            <label className="mt-4 block text-sm font-semibold">
              Thư mục
              <select
                key={selectedFolder}
                name="folderId"
                defaultValue={
                  selectedFolder !== "all" && selectedFolder !== "unfiled"
                    ? selectedFolder
                    : ""
                }
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 font-normal text-foreground"
              >
                <option value="">Chưa phân loại</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={busy || !storageConfigured}
              className="mt-5 w-full rounded-xl bg-accent px-4 py-3 font-bold text-white transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-950"
            >
              {uploadProgress
                ? `Đang upload ${uploadProgress.completed}/${uploadProgress.total}…`
                : selectedFiles.length > 1
                  ? `Upload ${selectedFiles.length} file lên R2`
                  : "Upload lên R2"}
            </button>
            {uploadProgress && (
              <div className="mt-3" aria-live="polite">
                <div className="h-2 overflow-hidden rounded-full bg-surface-raised">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-300"
                    style={{
                      width: `${(uploadProgress.completed / uploadProgress.total) * 100}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-center text-xs text-muted">
                  {uploadProgress.succeeded} thành công · {uploadProgress.failed} lỗi
                </p>
              </div>
            )}
          </form>

          <div>
            <section className="mb-5 rounded-2xl border border-border bg-surface p-4 shadow-[0_10px_30px_rgba(var(--shadow),0.05)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
                    Thư mục
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Gom media theo đề hoặc mục đích sử dụng.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void createFolder()}
                  className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-50 dark:text-slate-950"
                >
                  + Thư mục
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <FolderButton
                  active={selectedFolder === "all"}
                  label="Tất cả"
                  onClick={() => {
                    setSelectedFolder("all");
                    setPage(1);
                  }}
                />
                <FolderButton
                  active={selectedFolder === "unfiled"}
                  label="Chưa phân loại"
                  onClick={() => {
                    setSelectedFolder("unfiled");
                    setPage(1);
                  }}
                />
                {folders.map((folder) => (
                  <FolderButton
                    key={folder.id}
                    active={selectedFolder === folder.id}
                    label={`${folder.name} · ${folder._count.assets}`}
                    onClick={() => {
                      setSelectedFolder(folder.id);
                      setPage(1);
                    }}
                  />
                ))}
              </div>
              {selectedFolder !== "all" && selectedFolder !== "unfiled" && (
                <div className="mt-3 flex justify-end gap-2 border-t border-border pt-3 text-xs font-semibold">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const folder = folders.find(
                        (item) => item.id === selectedFolder,
                      );
                      if (folder) void renameFolder(folder);
                    }}
                    className="rounded-lg border border-border px-3 py-2 hover:border-accent"
                  >
                    Đổi tên
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const folder = folders.find(
                        (item) => item.id === selectedFolder,
                      );
                      if (folder) void removeFolder(folder);
                    }}
                    className="rounded-lg px-3 py-2 text-danger hover:bg-danger-soft"
                  >
                    Xóa thư mục
                  </button>
                </div>
              )}
            </section>
            <form onSubmit={submitSearch} className="flex flex-col gap-3 sm:flex-row">
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Tìm theo tên hoặc mô tả…"
                className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted/70"
              />
              <select
                value={type}
                onChange={(event) => {
                  setType(event.target.value as "" | MediaType);
                  setPage(1);
                }}
                className="rounded-xl border border-border bg-surface px-4 py-3 text-foreground"
              >
                <option value="">Tất cả loại</option>
                <option value="IMAGE">Ảnh</option>
                <option value="AUDIO">Audio</option>
              </select>
              <button className="rounded-xl border border-border bg-surface px-5 py-3 font-semibold hover:border-accent/50">
                Tìm kiếm
              </button>
            </form>

            <div className="mt-5 flex items-center justify-between text-sm text-muted">
              <span>{pagination.total} tài nguyên</span>
              <span>Trang {pagination.page}/{Math.max(1, pagination.totalPages)}</span>
            </div>

            {loading ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2"><MediaSkeleton /><MediaSkeleton /></div>
            ) : items.length === 0 ? (
              <div className="mt-5 rounded-3xl border border-dashed border-border bg-surface/60 px-6 py-16 text-center text-muted">
                Chưa có media phù hợp. Upload file đầu tiên ở khung bên trái.
              </div>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((media) => (
                  <MediaCard
                    key={media.id}
                    media={media}
                    folders={folders}
                    busy={busy}
                    onDelete={() => void remove(media)}
                    onSaveAlt={(value) => void updateAltText(media, value)}
                    onReplace={(file) => void replace(media, file)}
                    onUsages={() => void showUsages(media)}
                    onMove={(folderId) => void moveToFolder(media, folderId)}
                  />
                ))}
              </div>
            )}

            {pagination.totalPages > 1 && (
              <div className="mt-7 flex justify-center gap-3">
                <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-xl border border-border bg-surface px-4 py-2 disabled:opacity-40">Trước</button>
                <button disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-xl border border-border bg-surface px-4 py-2 disabled:opacity-40">Sau</button>
              </div>
            )}
          </div>
        </section>
      </div>

      {usage && <UsagePanel usage={usage} onClose={() => setUsage(null)} />}
    </main>
  );
}

function FolderButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
        active
          ? "border-accent bg-accent text-white dark:text-slate-950"
          : "border-border bg-background text-muted hover:border-accent/60 hover:text-foreground"
      }`}
    >
      <span className="mr-1.5">▰</span>
      {label}
    </button>
  );
}

function MediaCard({
  media,
  folders,
  busy,
  onDelete,
  onSaveAlt,
  onReplace,
  onUsages,
  onMove,
}: {
  media: MediaAsset;
  folders: MediaFolder[];
  busy: boolean;
  onDelete: () => void;
  onSaveAlt: (value: string) => void;
  onReplace: (file: File) => void;
  onUsages: () => void;
  onMove: (folderId: string | null) => void;
}) {
  const [altText, setAltText] = useState(media.altText ?? "");
  const usages = Object.values(media._count).reduce((total, count) => total + count, 0);

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_12px_35px_rgba(var(--shadow),0.07)]">
      {media.type === "IMAGE" ? (
        <div
          role="img"
          aria-label={media.altText ?? media.originalName}
          className="aspect-[4/3] bg-surface-raised bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${JSON.stringify(media.url)})` }}
        />
      ) : (
        <div className="flex aspect-[4/3] flex-col items-center justify-center bg-gradient-to-br from-accent-soft to-surface-raised p-5">
          <span className="text-4xl text-accent">♫</span>
          <audio controls preload="metadata" className="mt-5 w-full"><source src={media.url} type={media.mimeType} /></audio>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-bold" title={media.originalName}>{media.originalName}</h3>
            <p className="mt-1 text-xs text-muted">
              {formatBytes(media.sizeBytes)} · {media.type === "IMAGE" ? `${media.width}×${media.height}` : formatDuration(media.durationMs)}
            </p>
          </div>
          <span className="rounded-lg bg-accent-soft px-2 py-1 text-[10px] font-bold text-accent-strong">{media.type}</span>
        </div>
        <input
          value={altText}
          onChange={(event) => setAltText(event.target.value)}
          onBlur={() => {
            if (altText !== (media.altText ?? "")) onSaveAlt(altText);
          }}
          placeholder="Thêm mô tả…"
          className="mt-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
        <label className="mt-3 block text-xs font-semibold text-muted">
          Thư mục
          <select
            value={media.folder?.id ?? ""}
            disabled={busy}
            onChange={(event) => onMove(event.target.value || null)}
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground disabled:opacity-50"
          >
            <option value="">Chưa phân loại</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          <button type="button" onClick={onUsages} className="rounded-lg border border-border px-3 py-2 hover:border-accent/50">Dùng ở {usages} nơi</button>
          <label className="cursor-pointer rounded-lg border border-border px-3 py-2 hover:border-accent/50">
            Thay file
            <input
              type="file"
              className="hidden"
              accept={media.type === "IMAGE" ? "image/*" : "audio/*"}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onReplace(file);
                event.target.value = "";
              }}
            />
          </label>
          <button type="button" disabled={busy || usages > 0} onClick={onDelete} className="rounded-lg px-3 py-2 text-danger hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-40">Xóa</button>
        </div>
      </div>
    </article>
  );
}

function UsagePanel({ usage, onClose }: { usage: UsageDetails; onClose: () => void }) {
  const rows = [
    ...usage.fullListeningTests.map((item) => `Full audio: ${item.title}`),
    ...usage.stimulusItems.map((item) => `Stimulus: ${item.group.title ?? item.group.id}`),
    ...usage.directionAudioTemplates.map((item) => `Direction ${item.part} v${item.version}`),
    ...usage.exampleAudioTemplates.map((item) => `Example ${item.part} v${item.version}`),
    ...usage.questionAudioSegments.map((item) => `${item.segmentType}: câu ${item.questionId}`),
  ];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onMouseDown={onClose}>
      <section className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-3xl border border-border bg-surface p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-widest text-accent">Đang được sử dụng</p><h2 className="mt-2 text-xl font-bold">{usage.originalName}</h2></div>
          <button onClick={onClose} className="text-2xl text-muted">×</button>
        </div>
        {rows.length ? <ul className="mt-5 space-y-2">{rows.map((row) => <li key={row} className="rounded-xl bg-surface-raised px-4 py-3 text-sm">{row}</li>)}</ul> : <p className="mt-5 text-sm text-muted">Media này chưa được gắn vào nội dung nào.</p>}
      </section>
    </div>
  );
}

function MediaSkeleton() {
  return <div className="h-80 animate-pulse rounded-2xl border border-border bg-surface" />;
}

function formatBytes(value: string) {
  const bytes = Number(value);
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(value: number | null) {
  if (!value) return "—";
  const seconds = Math.round(value / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatBatchBytes(files: File[]) {
  return formatBytes(
    String(files.reduce((total, file) => total + file.size, 0)),
  );
}

async function uploadFilesConcurrently<Result>(
  files: File[],
  concurrency: number,
  uploadFile: (file: File) => Promise<Result>,
) {
  const results = new Array<Result>(files.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, files.length) },
    async () => {
      while (nextIndex < files.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await uploadFile(files[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

async function responseMessage(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { message?: string | string[] }
    | null;
  if (Array.isArray(payload?.message)) return payload.message.join(", ");
  return payload?.message ?? `Request failed (${response.status})`;
}
