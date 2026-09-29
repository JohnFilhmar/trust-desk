import { enforcement_action_type_schema } from "@trust-desk/shared";
import type { Account, EnforcementActionType, EnforcementResult } from "@trust-desk/shared";
import { useState } from "react";
import type { ReactElement } from "react";
import { EnforcementDialog } from "@/components/EnforcementDialog";
import { staffGroupLabels } from "@/lib/format/labels";
import { useFocusOnChange } from "@/lib/focus/useFocusOnChange";
import { useOperationalMode } from "@/lib/mode/useOperationalMode";
import { useSession } from "@/providers/SessionProvider";

/** Props of `EnforcementPanel`. */
export type EnforcementPanelProps = {
  /** The account on the page. */
  account: Account;
};

const confirmations: Readonly<Record<EnforcementActionType, string>> = {
  suspend: "Account suspended.",
  unsuspend: "Suspension lifted.",
  mark_spam: "Account marked as spam.",
};

/**
 * Offers the enforcement actions the signed-in user may take on an account,
 * or says why there are none. The server checks the same rules.
 *
 * @param props - See `EnforcementPanelProps`.
 */
export function EnforcementPanel({ account }: EnforcementPanelProps): ReactElement {
  const { user, can } = useSession();
  const modeQuery = useOperationalMode();
  const [openActionType, setOpenActionType] = useState<EnforcementActionType | null>(null);
  const [lastResult, setLastResult] = useState<EnforcementResult | null>(null);
  // The button that opened the dialog leaves the page once the action is
  // done, so focus moves to the confirmation.
  const confirmationRef = useFocusOnChange<HTMLParagraphElement>(lastResult);

  const canEnforce = can("accounts.enforce");
  const isSuspended = account.status === "suspended";
  // An unknown mode does not hide the button. The server refuses in lockdown.
  const isUnsuspendAllowed = modeQuery.data?.unsuspend_allowed !== false;
  const isOffered: Readonly<Record<EnforcementActionType, boolean>> = {
    suspend: !isSuspended,
    unsuspend: isSuspended && isUnsuspendAllowed,
    mark_spam: account.spam_marked_at === null,
  };

  return (
    <section aria-labelledby="enforcement-heading" className="flex flex-col gap-3">
      <h2 id="enforcement-heading" className="text-lg font-semibold">
        Enforcement
      </h2>
      {lastResult !== null && (
        <p
          ref={confirmationRef}
          tabIndex={-1}
          role="status"
          className="rounded-lg border border-risk-low bg-surface p-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {confirmations[lastResult.enforcement_action.action_type]} Audit row{" "}
          {lastResult.audit_log_id} holds the record.
        </p>
      )}
      {user !== null && !canEnforce && (
        <p className="text-sm text-ink-muted">
          Your group, {staffGroupLabels[user.group_name]}, cannot enforce. Only an enforcer may
          suspend, unsuspend or mark an account.
        </p>
      )}
      {canEnforce && isSuspended && !isUnsuspendAllowed && openActionType !== "unsuspend" && (
        <p className="text-sm text-ink-muted">
          Unsuspend is switched off during lockdown. Change the operational mode to lift a
          suspension.
        </p>
      )}
      {canEnforce && (
        <div className="flex gap-3">
          {/* A dialog stays while it is open, so a 409 can refresh the
              account without removing the message the analyst is reading. */}
          {enforcement_action_type_schema.options
            .filter((actionType) => isOffered[actionType] || openActionType === actionType)
            .map((actionType) => (
              <EnforcementDialog
                key={actionType}
                accountId={account.id}
                actionType={actionType}
                isOpen={openActionType === actionType}
                onOpenChange={(isOpen) => {
                  setOpenActionType(isOpen ? actionType : null);
                }}
                onEnforced={(result) => {
                  setOpenActionType(null);
                  setLastResult(result);
                }}
              />
            ))}
        </div>
      )}
    </section>
  );
}
