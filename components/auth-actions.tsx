"use client";

import Link from "next/link";
import { googleLoginUrl } from "@/lib/auth-client";
import { useAuth } from "./auth-provider";

export function AuthActions() {
  const { status, user, logout } = useAuth();

  if (status === "loading") return <span className="text-sm text-muted">Đang tải…</span>;
  if (!user) {
    return (
      <a
        href={googleLoginUrl}
        className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent-strong dark:text-slate-950"
      >
        Đăng nhập với Google
      </a>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted">{user.name ?? user.email}</span>
      <Link href="/history" className="text-accent hover:text-accent-strong">
        Lịch sử
      </Link>
      {user.role === "ADMIN" && (
        <Link href="/admin" className="text-accent hover:text-accent-strong">
          Quản trị
        </Link>
      )}
      <button
        type="button"
        onClick={() => void logout()}
        className="rounded-full border border-border px-4 py-2 hover:border-accent/50"
      >
        Đăng xuất
      </button>
    </div>
  );
}
