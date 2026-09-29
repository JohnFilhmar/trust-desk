import { account_status_schema } from "@trust-desk/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useSearchParams } from "react-router-dom";
import { AccountsTable } from "@/components/AccountsTable";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { SearchForm } from "@/components/SearchForm";
import { StatusFilter } from "@/components/StatusFilter";
import { Button } from "@/components/ui/Button";
import { accountsKey } from "@/lib/api/queryKeys";
import { parseSearchTerms } from "@/lib/search/searchTerms";
import { useApiClient } from "@/providers/ApiClientProvider";

// The first page has no cursor. An empty string stands for it, so the page
// parameter stays a plain string.
const firstPage = "";

/**
 * Lists accounts, filtered by the status and the search terms in the URL,
 * one page at a time. A status the contract does not know counts as no
 * filter. A search term the contract refuses sends no request.
 */
export function AccountsPage(): ReactElement {
  const apiClient = useApiClient();
  const [searchParams] = useSearchParams();
  const statusInUrl = account_status_schema.safeParse(searchParams.get("status"));
  const status = statusInUrl.success ? statusInUrl.data : undefined;
  const terms = parseSearchTerms(Object.fromEntries(searchParams));
  const filters = { status, ...terms };

  const accountsQuery = useInfiniteQuery({
    queryKey: accountsKey("list", filters),
    queryFn: ({ pageParam }) =>
      apiClient.searchAccounts({
        ...filters,
        cursor: pageParam === firstPage ? undefined : pageParam,
      }),
    initialPageParam: firstPage,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    enabled: terms !== null,
  });

  const accounts = accountsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <div className="flex items-center justify-between gap-6">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <StatusFilter selectedStatus={status} />
      </div>
      <SearchForm key={searchParams.toString()} />
      {terms === null && (
        <ErrorState
          error={null}
          heading="The search in the address is not valid"
          message="A search term needs 2 to 100 characters. Nothing was searched."
        />
      )}
      {terms !== null && accountsQuery.isPending && <LoadingState label="Loading accounts" />}
      {accountsQuery.isSuccess && accounts.length === 0 && (
        <EmptyState
          heading="No accounts match this filter"
          message="Pick another status or change the search to see more accounts."
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
