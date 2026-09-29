import type { ReactElement, ReactNode } from "react";

type BadgeTone = "neutral" | "positive" | "warning" | "danger";

/** Props of `Badge`. */
export type BadgeProps = {
  /** The color of the badge. It backs up the text and never replaces it. Defaults to `neutral`. */
  tone?: BadgeTone;
  /** The text of the badge. It must say the status in words. */
  children: ReactNode;
};

const toneClasses: Readonly<Record<BadgeTone, string>> = {
  neutral: "border-line text-ink-muted",
  positive: "border-risk-low text-risk-low",
  warning: "border-risk-medium text-risk-medium",
  danger: "border-risk-high text-risk-high",
};

/**
 * Renders a short status label.
 *
 * @param props - See `BadgeProps`.
 */
export function Badge({ tone = "neutral", children }: BadgeProps): ReactElement {
  return (
    <span
      className={`inline-flex items-center rounded-full border bg-surface px-2 py-0.5 text-xs font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
