"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";

export function RouteGuard({
  children,
  admin = false,
}: {
  children: React.ReactNode;
  admin?: boolean;
}) {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
    if (status === "authenticated" && admin && user?.role !== "ADMIN") {
      router.replace("/history");
    }
  }, [admin, router, status, user]);

  if (status === "loading") return <GuardMessage message="Đang khôi phục phiên…" />;
  if (status !== "authenticated" || (admin && user?.role !== "ADMIN")) {
    return <GuardMessage message="Đang chuyển hướng…" />;
  }
  return children;
}

function GuardMessage({ message }: { message: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 text-slate-300">
      <p>{message}</p>
    </main>
  );
}
