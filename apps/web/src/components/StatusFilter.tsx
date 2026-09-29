import type { AccountStatus } from "@trust-desk/shared";
import { Link } from "react-router-dom";
import type { ReactElement } from "react";
import { accountStatusLabels } from "@/lib/format/labels";

/** Props of `StatusFilter`. */
export type StatusFilterProps = {
  /** The status in the URL. `undefined` means every status. */
  selectedStatus: AccountStatus | undefined;
};

const choices: readonly { status: AccountStatus | undefined; label: string; to: string }[] = [
  { status: undefined, label: "All", to: "/accounts" },
  { status: "active", label: accountStatusLabels.active, to: "/accounts?status=active" },
  {
    status: "suspended",
    label: accountStatusLabels.suspended,
    to: "/accounts?status=suspended",
  },
];

/**
 * Lets the viewer pick which accounts the list shows. The choice lives in
 * the URL, so each choice is a link.
 *
 * @param props - See `StatusFilterProps`.
 */
export function StatusFilter({ selectedStatus }: StatusFilterProps): ReactElement {
  return (
    <nav aria-label="Filter by status" className="flex items-center gap-2">
      {choices.map((choice) => {
        const isSelected = choice.status === selectedStatus;
        return (
          <Link
            key={choice.label}
            to={choice.to}
            aria-current={isSelected ? "true" : undefined}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              isSelected
                ? "border-accent bg-accent text-accent-ink"
                : "border-line bg-surface text-ink hover:bg-canvas"
            }`}
          >
            {choice.label}
          </Link>
        );
      })}
    </nav>
  );
}
