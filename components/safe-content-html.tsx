export function SafeContentHtml({
  html,
  compact = false,
}: {
  html: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`safe-content-html min-w-0 max-w-full ${compact ? "safe-content-html--compact" : ""}`}
      dangerouslySetInnerHTML={{ __html: sanitizeContentHtml(html) }}
    />
  );
}

function sanitizeContentHtml(html: string) {
  return html
    .replace(
      /<\s*(script|iframe|object|embed|form|svg|math|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      "",
    )
    .replace(
      /<\s*\/?\s*(script|iframe|object|embed|form|input|button|link|meta|svg|math|style)\b[^>]*>/gi,
      "",
    )
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+srcdoc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(
      /\s+(href|src)\s*=\s*(["'])\s*(javascript|vbscript|data:text\/html)[\s\S]*?\2/gi,
      "",
    );
}
