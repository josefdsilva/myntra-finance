import type { ReactNode } from "react";

const WIDTHS = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
} as const;

type ShellWidth = keyof typeof WIDTHS;

/**
 * The canonical page-container classes for authenticated screens. Centralises
 * max-width, centering, vertical rhythm and responsive padding so every page
 * lines up and small screens get consistent, overflow-safe gutters. `min-w-0`
 * stops wide children (tables, flex rows) from forcing horizontal scroll on
 * narrow widths.
 */
export function pageShellClass(width: ShellWidth = "5xl", extra = ""): string {
  return `mx-auto w-full min-w-0 ${WIDTHS[width]} space-y-6 px-4 py-6 sm:px-6 md:px-8 md:py-8 ${extra}`.trim();
}

/** Component form of the shared page shell. */
export function PageShell({
  children,
  width = "5xl",
  className = "",
}: {
  children: ReactNode;
  width?: ShellWidth;
  className?: string;
}) {
  return <div className={pageShellClass(width, className)}>{children}</div>;
}
