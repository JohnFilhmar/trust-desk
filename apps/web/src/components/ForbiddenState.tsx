import type { ReactElement } from "react";

/** Props of `ForbiddenState`. */
export type ForbiddenStateProps = {
  /** The id to quote when the server refused the request. Absent when the app itself held the view back. */
  correlationId?: string;
};

/**
 * Tells the viewer that their group may not see a view or take an action.
 *
 * @param props - See `ForbiddenStateProps`.
 */
export function ForbiddenState({ correlationId }: ForbiddenStateProps): ReactElement {
  return (
    <div role="alert" className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-6">
      <p className="font-medium">Your group does not have access</p>
      <p className="text-sm text-ink-muted">
        Ask an administrator to change your group if you need it.
      </p>
      {correlationId !== undefined && (
        <p className="text-sm text-ink-muted">
          Correlation id: <code className="font-mono text-ink">{correlationId}</code>
        </p>
      )}
    </div>
  );
}
