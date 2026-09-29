import { account_status_schema } from "@trust-desk/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useSearchParams } from "react-router-dom";
import { AccountsTable } from "@/components/AccountsTable";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { StatusFilter } from "@/components/StatusFilter";
import { Button } from "@/components/ui/Button";
import { accountsKey } from "@/lib/api/queryKeys";
import { useApiClient } from "@/providers/ApiClientProvider";

// The first page has no cursor. An empty string stands for it, so the page
// parameter stays a plain string.
const firstPage = "";

/**
 * Lists accounts, filtered by the status in the URL, one page at a time.
 * A status the contract does not know counts as no filter.
 */
export function AccountsPage(): ReactElement {
  const apiClient = useApiClient();
  const [searchParams] = useSearchParams();
  const statusInUrl = account_status_schema.safeParse(searchParams.get("status"));
  const status = statusInUrl.success ? statusInUrl.data : undefined;

  const accountsQuery = useInfiniteQuery({
    queryKey: accountsKey("list", status),
    queryFn: ({ pageParam }) =>
      apiClient.searchAccounts({
        status,
        cursor: pageParam === firstPage ? undefined : pageParam,
      }),
    initialPageParam: firstPage,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  });

  const accounts = accountsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <div className="flex items-center justify-between gap-6">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <StatusFilter selectedStatus={status} />
      </div>
      {accountsQuery.isPending && <LoadingState label="Loading accounts" />}
      {accountsQuery.isSuccess && accounts.length === 0 && (
        <EmptyState
          heading="No accounts match this filter"
          message="Pick another status to see more accounts."
        />
      )}
      {accounts.length > 0 && <AccountsTable accounts={accounts} />}
      {accountsQuery.isError && (
        <ErrorState error={accountsQuery.error} heading="The accounts could not be loaded" />
      )}
      {accountsQuery.hasNextPage && (
        <div>
          <Button
            disabled={accountsQuery.isFetchingNextPage}
            onClick={() => {
              void accountsQuery.fetchNextPage();
            }}
          >
            {accountsQuery.isFetchingNextPage ? "Loading more accounts" : "Load more"}
          </Button>
        </div>
      )}
    </>
  );
}
