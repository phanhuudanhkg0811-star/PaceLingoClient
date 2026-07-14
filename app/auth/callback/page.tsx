"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export default function AuthCallbackPage() {
  const { acceptAccessToken } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState("Đang hoàn tất đăng nhập…");

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("access_token");
    window.history.replaceState(null, "", "/auth/callback");

    if (!token) {
      queueMicrotask(() =>
        setMessage("Không nhận được thông tin đăng nhập. Vui lòng thử lại."),
      );
      return;
    }

    void acceptAccessToken(token).then((success) => {
      if (success) router.replace("/history");
      else setMessage("Phiên đăng nhập không hợp lệ. Vui lòng thử lại.");
    });
  }, [acceptAccessToken, router]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <p>{message}</p>
    </main>
  );
}
