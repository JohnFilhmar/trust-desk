import { demo_accounts } from "@trust-desk/shared";
import type { DemoAccount, StaffGroup } from "@trust-desk/shared";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { staffGroupLabels } from "@/lib/format/labels";

/** Props of `DemoAccountsPanel`. */
export type DemoAccountsPanelProps = {
  /** Runs when the visitor picks a demo account. */
  onSignIn: (account: DemoAccount) => void;
  /** Disables every button while a sign-in runs. */
  isBusy: boolean;
};

const groupDescriptions: Readonly<Record<StaffGroup, string>> = {
  viewer: "Reads accounts and the audit trail. Cannot suspend an account.",
  analyst: "Investigates accounts and reads the audit trail. Cannot suspend an account.",
  enforcer: "Does what an analyst does, and may suspend an account with a reason.",
};

/**
 * Lists the demo staff users, each with a button that signs in as that user.
 *
 * @param props - See `DemoAccountsPanelProps`.
 */
export function DemoAccountsPanel({ onSignIn, isBusy }: DemoAccountsPanelProps): ReactElement {
  return (
    <section
      aria-labelledby="demo-accounts-heading"
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="demo-accounts-heading" className="text-lg font-semibold">
          Demo accounts
        </h2>
        <p className="text-sm text-ink-muted">
          One staff user per group. The password is public because every record is synthetic.
        </p>
      </div>
      <ul className="flex flex-col gap-4">
        {demo_accounts.map((account) => (
          <li key={account.email} className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="flex items-center gap-2 text-sm font-medium">
                {account.email}
                <Badge>{staffGroupLabels[account.group_name]}</Badge>
              </p>
              <p className="text-sm text-ink-muted">{groupDescriptions[account.group_name]}</p>
            </div>
            <Button
              disabled={isBusy}
              onClick={() => {
                onSignIn(account);
              }}
            >
              Sign in as {account.display_name}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
