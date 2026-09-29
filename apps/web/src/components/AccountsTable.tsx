import type { AccountSummary } from "@trust-desk/shared";
import type { ReactElement } from "react";
import { AccountStatusBadge } from "@/components/AccountStatusBadge";
import { Timestamp } from "@/components/Timestamp";
import { Badge } from "@/components/ui/Badge";
import { TextLink } from "@/components/ui/TextLink";

/** Props of `AccountsTable`. */
export type AccountsTableProps = {
  /** The rows, in the order the server sent them. The caller handles the empty list. */
  accounts: readonly AccountSummary[];
};

const headerCellClasses = "px-4 py-3 text-left text-xs font-medium text-ink-muted";
const cellClasses = "px-4 py-3 text-sm";

/**
 * Lists accounts, one per row, each linking to its own page.
 *
 * @param props - See `AccountsTableProps`.
 */
export function AccountsTable({ accounts }: AccountsTableProps): ReactElement {
  return (
    <table className="w-full rounded-lg border border-line bg-surface">
      <caption className="sr-only">Accounts</caption>
      <thead>
        <tr className="border-b border-line">
          <th scope="col" className={headerCellClasses}>
            Email
          </th>
          <th scope="col" className={headerCellClasses}>
            Status
          </th>
          <th scope="col" className={headerCellClasses}>
            Plan
          </th>
          <th scope="col" className={headerCellClasses}>
            Created
          </th>
          <th scope="col" className={headerCellClasses}>
            Flags
          </th>
        </tr>
      </thead>
      <tbody>
        {accounts.map((account) => (
          <tr key={account.id} className="border-b border-line last:border-b-0">
            <td className={cellClasses}>
              <TextLink to={`/accounts/${account.id}`}>{account.email}</TextLink>
            </td>
            <td className={cellClasses}>
              <AccountStatusBadge status={account.status} />
            </td>
            <td className={cellClasses}>{account.plan}</td>
            <td className={cellClasses}>
              <Timestamp value={account.created_at} />
            </td>
            <td className={cellClasses}>
              {account.spam_marked_at !== null && <Badge tone="warning">Marked as spam</Badge>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
