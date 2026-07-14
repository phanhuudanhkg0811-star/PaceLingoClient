"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
      <div>
        <h1 className="text-2xl font-semibold">Đã có lỗi xảy ra</h1>
        <p className="mt-2 text-muted">PaceLingo chưa thể tải nội dung này.</p>
        <button
          className="mt-6 rounded-full bg-accent px-5 py-2.5 font-bold text-white dark:text-slate-950"
          onClick={() => unstable_retry()}
        >
          Thử lại
        </button>
      </div>
    </main>
  );
}
