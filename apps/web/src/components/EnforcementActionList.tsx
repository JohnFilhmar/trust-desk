import type { EnforcementAction } from "@trust-desk/shared";
import type { ReactElement } from "react";
import { EmptyState } from "@/components/EmptyState";
import { Timestamp } from "@/components/Timestamp";
import { enforcementActionLabels } from "@/lib/format/labels";

/** Props of `EnforcementActionList`. */
export type EnforcementActionListProps = {
  /** The actions, newest first, as the server sent them. An empty list shows the empty state. */
  actions: readonly EnforcementAction[];
};

/**
 * Lists the enforcement actions taken against one account.
 *
 * @param props - See `EnforcementActionListProps`.
 */
export function EnforcementActionList({ actions }: EnforcementActionListProps): ReactElement {
  if (actions.length === 0) {
    return (
      <EmptyState
        heading="No enforcement actions"
        message="Nobody has acted against this account."
      />
    );
  }
  return (
    <ol className="flex flex-col rounded-lg border border-line bg-surface">
      {actions.map((action) => (
        <li
          key={action.id}
          className="flex flex-col gap-1 border-b border-line px-4 py-3 last:border-b-0"
        >
          <p className="text-sm font-medium">
            {enforcementActionLabels[action.action_type]}
            <span className="font-normal text-ink-muted">
              {" "}
              by staff user {action.staff_user_id}, <Timestamp value={action.created_at} />
            </span>
          </p>
          <p className="text-sm break-words">{action.reason}</p>
        </li>
      ))}
    </ol>
  );
}
