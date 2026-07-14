"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { googleLoginUrl } from "@/lib/auth-client";
import { useAuth } from "./auth-provider";

export function AuthActions() {
  const { status, user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (status === "loading") {
    return (
      <span className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
        <i className="size-8 animate-pulse rounded-full bg-accent-soft" />
        <i className="h-3 w-20 animate-pulse rounded bg-accent-soft" />
      </span>
    );
  }

  if (!user) {
    return (
      <a
        href={googleLoginUrl}
        className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-accent-strong"
      >
        Đăng nhập với Google
      </a>
    );
  }

  const displayName = user.name?.trim() || user.email.split("@")[0];

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex items-center gap-2.5 rounded-xl border bg-surface px-2 py-1.5 text-left shadow-sm transition hover:border-accent/40 hover:bg-surface-raised ${open ? "border-accent/50 ring-2 ring-accent/10" : "border-border"}`}
      >
        <Avatar
          name={displayName}
          url={failedAvatarUrl === user.avatarUrl ? null : user.avatarUrl}
          onError={() => setFailedAvatarUrl(user.avatarUrl)}
          size="sm"
        />
        <span className="hidden max-w-32 truncate text-sm font-extrabold text-foreground sm:block">
          {displayName}
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-72 max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_22px_65px_rgba(var(--shadow),0.2)]"
        >
          <div className="border-b border-border bg-gradient-to-br from-accent-soft/80 to-surface px-4 py-4">
            <div className="flex items-center gap-3">
              <Avatar
                name={displayName}
                url={failedAvatarUrl === user.avatarUrl ? null : user.avatarUrl}
                onError={() => setFailedAvatarUrl(user.avatarUrl)}
                size="lg"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-foreground">{displayName}</p>
                <p className="mt-0.5 truncate text-xs text-muted">{user.email}</p>
                <span className="mt-2 inline-flex rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-strong">
                  {user.role === "ADMIN" ? "Administrator" : "PaceLingo member"}
                </span>
              </div>
            </div>
          </div>

          <div className="p-2">
            <MenuLink
              href="/history"
              label="Lịch sử làm bài"
              description="Xem các lượt thi và kết quả"
              icon={<HistoryIcon />}
              close={() => setOpen(false)}
            />
            {user.role === "ADMIN" && (
              <MenuLink
                href="/admin"
                label="Trang quản trị"
                description="Quản lý đề thi và nội dung"
                icon={<AdminIcon />}
                close={() => setOpen(false)}
              />
            )}
          </div>

          <div className="border-t border-border p-2">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-danger transition hover:bg-danger-soft"
            >
              <LogoutIcon />
              Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({
  name,
  url,
  onError,
  size,
}: {
  name: string;
  url: string | null;
  onError: () => void;
  size: "sm" | "lg";
}) {
  const dimensions = size === "lg" ? "size-12 text-base" : "size-8 text-xs";
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#0b4f8a] to-[#38a3ff] font-black text-white shadow-sm ${dimensions}`}
    >
      {url ? (
        <img
          src={url}
          alt={`Ảnh đại diện của ${name}`}
          referrerPolicy="no-referrer"
          onError={onError}
          className="size-full object-cover"
        />
      ) : (
        firstCharacter(name)
      )}
    </span>
  );
}

function MenuLink({
  href,
  label,
  description,
  icon,
  close,
}: {
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  close: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={close}
      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-accent-soft/70"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-strong transition group-hover:bg-accent group-hover:text-white">
        {icon}
      </span>
      <span className="min-w-0">
        <strong className="block text-sm text-foreground">{label}</strong>
        <span className="mt-0.5 block truncate text-[11px] text-muted">{description}</span>
      </span>
    </Link>
  );
}

function firstCharacter(value: string) {
  return Array.from(value.trim())[0]?.toLocaleUpperCase("vi") ?? "U";
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={`size-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HistoryIcon() {
  return <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5" strokeLinecap="round" /><path d="M4 4v4.5h4.5M12 8v4l2.5 1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function AdminIcon() {
  return <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M4 9h16M8 13h3m-3 3h6" strokeLinecap="round" /></svg>;
}

function LogoutIcon() {
  return <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-3M10 12h11m-3-3 3 3-3 3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
