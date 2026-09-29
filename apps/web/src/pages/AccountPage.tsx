import { account_id_param_schema } from "@trust-desk/shared";
import { useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useParams } from "react-router-dom";
import { AccountStatusBadge } from "@/components/AccountStatusBadge";
import { EnforcementActionList } from "@/components/EnforcementActionList";
import { EnforcementPanel } from "@/components/EnforcementPanel";
import { ErrorState } from "@/components/ErrorState";
import { Field } from "@/components/Field";
import { LoadingState } from "@/components/LoadingState";
import { Timestamp } from "@/components/Timestamp";
import { Badge } from "@/components/ui/Badge";
import { TextLink } from "@/components/ui/TextLink";
import { accountsKey } from "@/lib/api/queryKeys";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { useApiClient } from "@/providers/ApiClientProvider";

const panelClasses = "grid grid-cols-3 gap-6 rounded-lg border border-line bg-surface p-6";

/**
 * Shows one account, its signup context and its enforcement actions.
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

  const { account, enforcement_actions } = accountQuery.data;
  const { signup_context } = account;

  return (
    <>
      <div className="flex flex-col gap-2">
        <TextLink to="/accounts">Back to accounts</TextLink>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Account {account.id}</h1>
          <AccountStatusBadge status={account.status} />
          {account.spam_marked_at !== null && <Badge tone="warning">Marked as spam</Badge>}
        </div>
        {!account.pii_revealed && (
          <p className="text-sm text-ink-muted">
            The server masks the personal data on this page.
          </p>
        )}
      </div>

      <section aria-labelledby="account-heading" className="flex flex-col gap-3">
        <h2 id="account-heading" className="text-lg font-semibold">
          Account
        </h2>
        <dl className={panelClasses}>
          <Field label="Email">{account.email}</Field>
          <Field label="Plan">{account.plan}</Field>
          <Field label="Created">
            <Timestamp value={account.created_at} />
          </Field>
          <Field label="Marked as spam">
            {account.spam_marked_at === null ? "No" : <Timestamp value={account.spam_marked_at} />}
          </Field>
        </dl>
      </section>

      <section aria-labelledby="signup-heading" className="flex flex-col gap-3">
        <h2 id="signup-heading" className="text-lg font-semibold">
          Signup context
        </h2>
        <dl className={panelClasses}>
          <Field label="IP address">{signup_context.ip}</Field>
          <Field label="Country">{signup_context.country}</Field>
          <Field label="Device fingerprint">{signup_context.device_fingerprint}</Field>
          <Field label="User agent">{signup_context.user_agent}</Field>
          <Field label="Referral">{signup_context.referral ?? "None"}</Field>
        </dl>
      </section>

      <EnforcementPanel key={account.id} account={account} />

      <section aria-labelledby="actions-heading" className="flex flex-col gap-3">
        <h2 id="actions-heading" className="text-lg font-semibold">
          Enforcement actions
        </h2>
        <EnforcementActionList actions={enforcement_actions} />
      </section>
    </>
  );
}
