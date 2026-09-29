import type { Account } from "@trust-desk/shared";
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { SuspendDialog } from "@/components/SuspendDialog";
import { staffGroupLabels } from "@/lib/format/labels";
import { useSession } from "@/providers/SessionProvider";

/** Props of `EnforcementPanel`. */
export type EnforcementPanelProps = {
  /** The account on the page. */
  account: Account;
};

/**
 * Offers the enforcement actions the signed-in user may take on an account,
 * or says why there are none. The server checks the same rules.
 *
 * @param props - See `EnforcementPanelProps`.
 */
export function EnforcementPanel({ account }: EnforcementPanelProps): ReactElement {
  const { user, can } = useSession();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [hasSuspended, setHasSuspended] = useState(false);
  const confirmationRef = useRef<HTMLParagraphElement>(null);

  // The button that opened the dialog leaves the page once the account is
  // suspended, so focus moves to the confirmation and is not lost.
  useEffect(() => {
    if (hasSuspended) {
      confirmationRef.current?.focus();
    }
  }, [hasSuspended]);

  const canEnforce = can("accounts.enforce");
  const isActive = account.status === "active";

  return (
    <section aria-labelledby="enforcement-heading" className="flex flex-col gap-3">
      <h2 id="enforcement-heading" className="text-lg font-semibold">
        Enforcement
      </h2>
      {hasSuspended && (
        <p
          ref={confirmationRef}
          tabIndex={-1}
          role="status"
          className="rounded-lg border border-risk-low bg-surface p-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Account suspended. The audit trail holds the record.
        </p>
      )}
      {user !== null && !canEnforce && (
        <p className="text-sm text-ink-muted">
          Your group, {staffGroupLabels[user.group_name]}, cannot enforce. Only an enforcer may
          suspend an account.
        </p>
      )}
      {canEnforce && !isActive && !isDialogOpen && (
        <p className="text-sm text-ink-muted">
          This account is suspended, so there is nothing to suspend.
        </p>
      )}
      {/* The dialog stays while it is open, so a 409 can refresh the account
          to suspended without removing the message the analyst is reading. */}
      {canEnforce && (isActive || isDialogOpen) && (
        <div>
          <SuspendDialog
            accountId={account.id}
            isOpen={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            onSuspended={() => {
              setIsDialogOpen(false);
              setHasSuspended(true);
            }}
          />
        </div>
      )}
    </section>
  );
}
