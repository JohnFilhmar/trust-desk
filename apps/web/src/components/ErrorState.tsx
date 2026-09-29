import type { ReactElement } from "react";
import { ForbiddenState } from "@/components/ForbiddenState";
import { ApiError } from "@/lib/api/apiError";

/** Props of `ErrorState`. */
export type ErrorStateProps = {
  /** What a query or a mutation failed with. Anything that is not an `Error` gets a generic message. */
  error: unknown;
  /** Replaces the default heading. */
  heading?: string;
  /** Replaces the message the error carries. Use it when the server's wording must not be shown. */
  message?: string;
};

/**
 * Shows a failed request with its message and the correlation id to quote.
 *
 * @param props - See `ErrorStateProps`. A 403 renders the forbidden state.
 */
export function ErrorState({
  error,
  heading = "Something went wrong",
  message,
}: ErrorStateProps): ReactElement {
  if (error instanceof ApiError && error.status === 403) {
    return <ForbiddenState correlationId={error.correlationId} />;
  }
  const shownMessage =
    message ?? (error instanceof Error ? error.message : "The request failed. Try again.");
  return (
    <div
      role="alert"
      className="flex flex-col gap-1 rounded-lg border border-risk-high bg-surface p-6"
    >
      <p className="font-medium text-risk-high">{heading}</p>
      <p className="text-sm">{shownMessage}</p>
      {error instanceof ApiError && (
        <p className="text-sm text-ink-muted">
          Correlation id: <code className="font-mono text-ink">{error.correlationId}</code>
        </p>
      )}
    </div>
  );
}
