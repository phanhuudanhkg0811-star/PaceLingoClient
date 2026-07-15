"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { apiFetch } from "@/lib/auth-client";

export function ContactForm() {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await apiFetch("/feedback/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          subject: form.get("subject"),
          message: form.get("message"),
          website: form.get("website"),
        }),
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const data = (await response.json()) as { reference?: string };
      setSuccess(data.reference ?? "received");
      event.currentTarget.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không gửi được liên hệ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-10">
      <Link href="/" aria-label="Quay lại" className="grid size-11 place-items-center rounded-2xl border border-border bg-surface shadow-sm">←</Link>
      <div className="mt-8 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <section className="rounded-[2rem] bg-gradient-to-br from-[#061d42] to-[#0868ae] p-8 text-white shadow-xl sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-300">Contact</p>
          <h1 className="mt-4 text-4xl font-black">Liên hệ PaceLingo</h1>
          <p className="mt-5 leading-7 text-blue-100/85">Gửi góp ý sản phẩm, yêu cầu hỗ trợ tài khoản hoặc vấn đề về quyền riêng tư. Với lỗi của một câu hỏi cụ thể, hãy dùng nút “Báo lỗi câu này” trong trang Review.</p>
          <div className="mt-8 space-y-3 text-sm text-blue-100"><p>✓ Phản hồi được lưu kèm mã tham chiếu</p><p>✓ Không gửi mật khẩu hoặc token đăng nhập</p><p>✓ Mô tả rõ thiết bị và bước gây lỗi nếu có</p></div>
        </section>

        <section className="rounded-[2rem] border border-border bg-surface p-6 shadow-sm sm:p-8">
          {success ? (
            <div className="py-12 text-center"><span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-700">✓</span><h2 className="mt-5 text-2xl font-black">Đã nhận liên hệ</h2><p className="mt-2 text-sm text-muted">Mã tham chiếu: <strong className="text-foreground">{success}</strong></p><button onClick={() => setSuccess(null)} className="mt-6 rounded-xl bg-accent px-5 py-3 text-sm font-black text-white">Gửi nội dung khác</button></div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2"><Field label="Họ tên" name="name" autoComplete="name" /><Field label="Email" name="email" type="email" autoComplete="email" /></div>
              <Field label="Chủ đề" name="subject" />
              <label className="block text-sm font-bold">Nội dung<textarea name="message" required minLength={10} maxLength={5000} rows={7} className="mt-2 w-full resize-y rounded-xl border border-border bg-surface-raised px-4 py-3 font-normal outline-none focus:border-accent" placeholder="Mô tả vấn đề hoặc góp ý của bạn…" /></label>
              <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              {error && <p className="rounded-xl bg-danger-soft p-3 text-sm font-semibold text-danger">{error}</p>}
              <button disabled={submitting} className="w-full rounded-xl bg-gradient-to-r from-[#07579a] to-[#1677c8] px-5 py-3.5 text-sm font-black text-white disabled:opacity-50">{submitting ? "Đang gửi…" : "Gửi liên hệ"}</button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, name, type = "text", autoComplete }: { label: string; name: string; type?: string; autoComplete?: string }) {
  return <label className="block text-sm font-bold">{label}<input name={name} type={type} autoComplete={autoComplete} required minLength={2} maxLength={type === "email" ? 254 : 160} className="mt-2 w-full rounded-xl border border-border bg-surface-raised px-4 py-3 font-normal outline-none focus:border-accent" /></label>;
}

async function responseMessage(response: Response) {
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
  return payload?.message ?? `Không gửi được (${response.status})`;
}
