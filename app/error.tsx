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
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-slate-100">
      <div>
        <h1 className="text-2xl font-semibold">Đã có lỗi xảy ra</h1>
        <p className="mt-2 text-slate-400">PaceLingo chưa thể tải nội dung này.</p>
        <button
          className="mt-6 rounded-full bg-emerald-500 px-5 py-2.5 font-medium text-slate-950"
          onClick={() => unstable_retry()}
        >
          Thử lại
        </button>
      </div>
    </main>
  );
}
