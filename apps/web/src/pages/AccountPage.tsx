import { account_id_param_schema } from "@trust-desk/shared";
import { useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useParams } from "react-router-dom";
import { AccountDetail } from "@/components/AccountDetail";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { accountsKey } from "@/lib/api/queryKeys";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { useApiClient } from "@/providers/ApiClientProvider";

/**
 * Shows one account with its risk, its timeline and its enforcement.
 * An `account_id` that is not a positive whole number shows the not-found page.
 */
export function AccountPage(): ReactElement {
  const apiClient = useApiClient();
  const params = useParams();
  const accountIdInUrl = account_id_param_schema.safeParse(params["account_id"]);
  const accountId = accountIdInUrl.success ? accountIdInUrl.data : 0;

  const accountQuery = useQuery({
    queryKey: accountsKey("detail", accountId),
    queryFn: () => apiClient.fetchAccount(accountId),
    enabled: accountIdInUrl.success,
  });

  if (!accountIdInUrl.success) {
    return <NotFoundPage />;
  }
  if (accountQuery.isPending) {
    return <LoadingState label="Loading the account" />;
  }
  if (accountQuery.isError) {
    return <ErrorState error={accountQuery.error} heading="The account could not be loaded" />;
  }
  return <AccountDetail key={accountQuery.data.account.id} detail={accountQuery.data} />;
}
