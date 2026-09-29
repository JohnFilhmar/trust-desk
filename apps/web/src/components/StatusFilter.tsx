import type { AccountStatus } from "@trust-desk/shared";
import { Link, useSearchParams } from "react-router-dom";
import type { ReactElement } from "react";
import { accountStatusLabels } from "@/lib/format/labels";

/** Props of `StatusFilter`. */
export type StatusFilterProps = {
  /** The status in the URL. `undefined` means every status. */
  selectedStatus: AccountStatus | undefined;
};

const choices: readonly { status: AccountStatus | undefined; label: string }[] = [
  { status: undefined, label: "All" },
  { status: "active", label: accountStatusLabels.active },
  { status: "suspended", label: accountStatusLabels.suspended },
];

/**
 * Lets the viewer pick which accounts the list shows. The choice lives in
 * the URL, so each choice is a link. A link keeps the search terms that are
 * in the URL and changes the status only.
 *
 * @param props - See `StatusFilterProps`.
 */
export function StatusFilter({ selectedStatus }: StatusFilterProps): ReactElement {
  const [searchParams] = useSearchParams();

  function pathFor(status: AccountStatus | undefined): string {
    const next = new URLSearchParams(searchParams);
    next.delete("status");
    if (status !== undefined) {
      next.set("status", status);
    }
    const query = next.toString();
    return query === "" ? "/accounts" : `/accounts?${query}`;
  }

  return (
    <nav aria-label="Filter by status" className="flex items-center gap-2">
      {choices.map((choice) => {
        const isSelected = choice.status === selectedStatus;
        return (
          <Link
            key={choice.label}
            to={pathFor(choice.status)}
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
