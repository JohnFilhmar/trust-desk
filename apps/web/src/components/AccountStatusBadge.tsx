import type { AccountStatus } from "@trust-desk/shared";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/Badge";
import { accountStatusLabels } from "@/lib/format/labels";

/** Props of `AccountStatusBadge`. */
export type AccountStatusBadgeProps = {
  status: AccountStatus;
};

/**
 * Shows an account's status in words, with a color to back the words up.
 *
 * @param props - See `AccountStatusBadgeProps`.
 */
export function AccountStatusBadge({ status }: AccountStatusBadgeProps): ReactElement {
  return (
    <Badge tone={status === "active" ? "positive" : "danger"}>
      {accountStatusLabels[status]}
    </Badge>
  );
}
