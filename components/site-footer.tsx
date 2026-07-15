import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface/75">
      <div className="mx-auto max-w-7xl px-5 py-9 sm:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-black text-foreground">Pace<span className="text-accent">Lingo</span></p>
            <p className="mt-2 max-w-lg text-xs leading-5 text-muted">Nền tảng luyện tập độc lập. PaceLingo không liên kết, được tài trợ hay chứng thực bởi ETS hoặc IIG Việt Nam. TOEIC là nhãn hiệu của ETS.</p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-muted">
            <Link href="/privacy" className="hover:text-accent-strong">Quyền riêng tư</Link>
            <Link href="/terms" className="hover:text-accent-strong">Điều khoản</Link>
            <Link href="/contact" className="hover:text-accent-strong">Liên hệ</Link>
          </nav>
        </div>
        <div className="mt-7 border-t border-border pt-5 text-xs text-muted">© {new Date().getFullYear()} PaceLingo. Nội dung và phần mềm thuộc bản quyền của PaceLingo.</div>
      </div>
    </footer>
  );
}
