import type { ReactElement } from "react";

/** Props of `EmptyState`. */
export type EmptyStateProps = {
  /** What is missing, such as "No accounts match this filter". */
  heading: string;
  /** What the viewer can do about it. */
  message: string;
};

/**
 * Tells the viewer that a request worked and found nothing.
 *
 * @param props - See `EmptyStateProps`.
 */
export function EmptyState({ heading, message }: EmptyStateProps): ReactElement {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-6">
      <p className="font-medium">{heading}</p>
      <p className="text-sm text-ink-muted">{message}</p>
    </div>
  );
}
