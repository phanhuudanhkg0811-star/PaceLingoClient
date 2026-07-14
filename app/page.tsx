import Link from "next/link";
import { AuthActions } from "@/components/auth-actions";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <main className="min-h-screen w-full max-w-full overflow-x-clip bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-5 px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-xl font-black tracking-tight text-[#0b4f8a] dark:text-white">
              Pace<span className="text-accent">Lingo</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-md font-semibold text-muted lg:flex">
            <a href="#experience" className="transition hover:text-accent">Trải nghiệm thi</a>
            <a href="#features" className="transition hover:text-accent">Tính năng</a>
            <Link href="/tests" className="transition hover:text-accent">Đề thi</Link>
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden md:block"><AuthActions /></div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <section className="relative bg-background">
        <div className="pointer-events-none absolute -left-40 top-12 size-[34rem] rounded-full bg-blue-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-52 top-0 size-[38rem] rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="mx-auto grid min-h-[calc(100vh-72px)] max-w-7xl items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:py-20">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-accent-strong">
              <span className="size-2 rounded-full bg-accent shadow-[0_0_0_5px_color-mix(in_srgb,var(--accent)_15%,transparent)]" />
              TOEIC Test Simulator
            </div>
            <h1 className="mt-7 max-w-2xl text-5xl font-black leading-[1.08] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              Luyện đúng nhịp.
              <span className="mt-1 block bg-gradient-to-r from-[#0b4f8a] via-[#1677c8] to-[#38a3ff] bg-clip-text text-transparent">
                Thi thật tự tin.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted sm:text-xl">
              Làm quen với áp lực thời gian, giao diện và nhịp độ của một bài TOEIC thật trước khi bước vào phòng thi.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/tests"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0b4f8a] to-[#1677c8] px-7 py-4 text-sm font-black text-white shadow-xl shadow-blue-900/20 transition hover:-translate-y-0.5 hover:shadow-2xl"
              >
                Bắt đầu thi thử
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
              <a
                href="#experience"
                className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-7 py-4 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40"
              >
                Xem trải nghiệm
              </a>
            </div>
            <div className="mt-5 md:hidden"><AuthActions /></div>

            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4 border-t border-border pt-6">
              <HeroMetric value="200" label="câu/full test" />
              <HeroMetric value="120'" label="mô phỏng thời gian" />
              <HeroMetric value="7 Parts" label="đủ Listening & Reading" />
            </div>
          </div>

          <ExamPreview />
        </div>
      </section>

      <section id="features" className="border-y border-border bg-background py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionHeading
            eyebrow="Luyện thi có chiến lược"
            title="Không chỉ làm đề. Bạn đang luyện cho ngày thi thật."
            description="Mọi chi tiết đều được thiết kế để bạn tập trung, kiểm soát thời gian và hình thành phản xạ làm bài ổn định."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <FeatureCard
              icon="clock"
              title="Nhịp thi sát thực tế"
              description="Listening chạy liên tục theo timeline. Reading có đồng hồ server và tự động nộp khi hết giờ."
            />
            <FeatureCard
              icon="screen"
              title="Giao diện phòng thi"
              description="Passage và câu hỏi chia hai vùng, chuyển nhóm câu, đánh dấu và danh mục câu trực quan."
            />
            <FeatureCard
              icon="chart"
              title="Kết quả dễ hiểu"
              description="Xem điểm Listening, Reading, số câu đúng và đánh giá nhanh sau khi hoàn thành bài thi."
            />
          </div>
        </div>
      </section>

      <section id="experience" className="bg-background py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="relative overflow-hidden rounded-[2rem] bg-[#061b3a] px-6 py-12 text-white shadow-2xl shadow-blue-950/20 sm:px-12 lg:px-16 lg:py-16">
            <div className="absolute -right-24 -top-28 size-96 rounded-full bg-blue-400/20 blur-3xl" />
            <div className="absolute -bottom-32 left-1/3 size-80 rounded-full bg-cyan-300/10 blur-3xl" />
            <div className="relative grid items-center gap-12 lg:grid-cols-2">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-300">Exam experience</p>
                <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
                  Tập trung vào bài thi,
                  <span className="block text-sky-300">không bị phân tâm bởi công cụ.</span>
                </h2>
                <p className="mt-5 max-w-xl leading-7 text-blue-100/75">
                  Đáp án được lưu tự động, reload không reset thời gian và tiến độ được khôi phục an toàn. Bạn chỉ cần làm một việc: giải đề.
                </p>
                <Link
                  href="/tests"
                  className="mt-8 inline-flex rounded-xl bg-white px-6 py-3.5 text-sm font-black text-[#0b4f8a] transition hover:bg-sky-50"
                >
                  Vào phòng thi →
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <ExperienceItem number="01" text="Đồng hồ lấy thời gian từ server" />
                <ExperienceItem number="02" text="Tự lưu đáp án và câu đã flag" />
                <ExperienceItem number="03" text="Listening tự chuyển theo audio" />
                <ExperienceItem number="04" text="Kết quả theo thang điểm TOEIC" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-background px-5 pb-24 sm:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-accent">Sẵn sàng chưa?</p>
          <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Bắt đầu một lượt thi nghiêm túc.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted">
            Biết mình đang ở đâu, quen với cảm giác thi thật và cải thiện qua từng lượt làm bài.
          </p>
          <Link
            href="/tests"
            className="mt-8 inline-flex rounded-xl bg-accent px-8 py-4 text-sm font-black text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 hover:bg-accent-strong"
          >
            Chọn đề và bắt đầu
          </Link>
        </div>
      </section>

      <footer className="border-t border-border bg-surface/70">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-7 text-sm text-muted sm:flex-row sm:px-8">
          <p className="font-bold text-foreground">PaceLingo</p>
          <p>Luyện TOEIC đúng nhịp, tiến bộ đúng hướng.</p>
        </div>
      </footer>
    </main>
  );
}

function ExamPreview() {
  return (
    <div className="relative mx-auto w-full max-w-2xl lg:mx-0">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-blue-500/20 to-cyan-300/5 blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-[#edf2f7] shadow-[0_30px_90px_rgba(2,20,48,0.28)] dark:border-blue-300/10">
        <div className="grid h-13 grid-cols-[auto_1fr_auto] items-center gap-3 bg-[#061b3a] px-4 text-white">
          <span className="rounded bg-white px-2 py-1 text-[9px] font-black text-[#0b4f8a]">PACE<span className="text-[#2493dd]">LINGO</span></span>
          <strong className="truncate text-center text-xs sm:text-sm">Reading: Questions 151–152 of 200</strong>
          <span className="rounded bg-[#1677c8] px-2.5 py-1.5 text-[10px] font-bold tabular-nums">01:06:50</span>
        </div>
        <div className="grid min-h-80 gap-2 p-3 sm:grid-cols-2 sm:p-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-slate-700">
            <p className="text-xs font-bold text-[#0b4f8a]">Read the following notice.</p>
            <div className="mt-5 rounded border border-slate-300 p-4 text-[10px] leading-5">
              <strong className="text-sm">CANTO</strong>
              <p className="mt-1">1508 Green Star Rd.</p>
              <p>Blue Avenue, BA</p>
              <h3 className="mt-4 text-center font-bold">AUTUMN BLINK PREMIERE</h3>
              <p className="mt-3">Join us for an unforgettable evening featuring our newest collection.</p>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-slate-700">
            <p className="text-xs font-bold text-[#0b4f8a]">Question</p>
            <p className="mt-4 text-[11px] font-bold">151. What is the purpose of the notice?</p>
            <div className="mt-3 space-y-2">
              {["To introduce a product", "To announce an event", "To request information", "To confirm a reservation"].map((answer, index) => (
                <div key={answer} className={`flex items-center gap-2 rounded border px-3 py-2 text-[10px] ${index === 1 ? "border-blue-400 bg-blue-50" : "border-slate-200"}`}>
                  <span className={`size-3 rounded-full border ${index === 1 ? "border-blue-600 bg-blue-600 shadow-[inset_0_0_0_2px_white]" : "border-slate-400"}`} />
                  ({String.fromCharCode(65 + index)}) {answer}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex h-11 items-center justify-between border-t border-slate-300 bg-white px-4 text-[10px] text-slate-600">
          <span className="flex items-center gap-2"><i className="size-4 rounded border border-slate-400" /> Mark for review</span>
          <span className="rounded bg-[#1677c8] px-4 py-2 font-bold text-white">Next →</span>
        </div>
      </div>
      <div className="absolute -bottom-7 -left-5 hidden rounded-2xl border border-border bg-surface px-5 py-4 shadow-xl sm:block">
        <p className="text-xs font-bold text-muted">Autosaved</p>
        <p className="mt-1 text-sm font-black text-accent-strong">Không mất bài khi reload</p>
      </div>
    </div>
  );
}

function HeroMetric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <strong className="text-xl font-black text-accent-strong">{value}</strong>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-accent">{eyebrow}</p>
      <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">{title}</h2>
      <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted">{description}</p>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: "clock" | "screen" | "chart";
  title: string;
  description: string;
}) {
  return (
    <article className="group rounded-2xl border border-border bg-surface p-6 shadow-[0_12px_35px_rgba(var(--shadow),0.06)] transition hover:-translate-y-1 hover:border-accent/30 hover:shadow-[0_18px_50px_rgba(var(--shadow),0.1)]">
      <span className="grid size-12 place-items-center rounded-xl bg-accent-soft text-accent-strong transition group-hover:bg-accent group-hover:text-white">
        <FeatureIcon name={icon} />
      </span>
      <h3 className="mt-5 text-xl font-black">{title}</h3>
      <p className="mt-3 leading-7 text-muted">{description}</p>
    </article>
  );
}

function FeatureIcon({ name }: { name: "clock" | "screen" | "chart" }) {
  if (name === "clock") {
    return <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" strokeLinecap="round" /></svg>;
  }
  if (name === "screen") {
    return <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M12 4v14M8 21h8" strokeLinecap="round" /></svg>;
  }
  return <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 19V9m7 10V5m7 14v-7" strokeLinecap="round" /><path d="M3 19.5h18" /></svg>;
}

function ExperienceItem({ number, text }: { number: string; text: string }) {
  return (
    <div className="rounded-xl border border-blue-300/15 bg-white/6 p-5 backdrop-blur">
      <span className="text-xs font-black text-sky-300">{number}</span>
      <p className="mt-3 text-sm font-bold leading-6 text-blue-50">{text}</p>
    </div>
  );
}
