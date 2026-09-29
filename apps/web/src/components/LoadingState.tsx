import type { ReactElement } from "react";

/** Props of `LoadingState`. */
export type LoadingStateProps = {
  /** What is loading, as a short sentence such as "Loading accounts". */
  label: string;
};

/**
 * Tells the viewer, and a screen reader, that something is loading.
 *
 * @param props - See `LoadingStateProps`.
 */
export function LoadingState({ label }: LoadingStateProps): ReactElement {
  return (
    <p role="status" className="rounded-lg border border-line bg-surface p-6 text-sm text-ink-muted">
      {label}
    </p>
  );
}
