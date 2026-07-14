"use client";

import Link from "next/link";
import { googleLoginUrl } from "@/lib/auth-client";
import { useAuth } from "./auth-provider";

export function AuthActions() {
  const { status, user, logout } = useAuth();

  if (status === "loading") return <span className="text-sm text-slate-400">Đang tải…</span>;
  if (!user) {
    return (
      <a
        href={googleLoginUrl}
        className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-emerald-400"
      >
        Đăng nhập với Google
      </a>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-slate-300">{user.name ?? user.email}</span>
      <Link href="/history" className="text-emerald-300 hover:text-emerald-200">
        Lịch sử
      </Link>
      {user.role === "ADMIN" && (
        <Link href="/admin" className="text-emerald-300 hover:text-emerald-200">
          Quản trị
        </Link>
      )}
      <button
        type="button"
        onClick={() => void logout()}
        className="rounded-full border border-slate-700 px-4 py-2 hover:border-slate-500"
      >
        Đăng xuất
      </button>
    </div>
  );
}
