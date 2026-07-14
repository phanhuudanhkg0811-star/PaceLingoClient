"use client";

import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="grid size-10 place-items-center rounded-xl border border-border bg-surface text-lg text-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent"
    >
      {theme === null ? "◐" : isDark ? "☀" : "☾"}
    </button>
  );
}
