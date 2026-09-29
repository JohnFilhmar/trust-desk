import type { AccountDetailResponse, RevealResponse } from "@trust-desk/shared";
import { useState } from "react";
import type { ReactElement } from "react";
import { AccountStatusBadge } from "@/components/AccountStatusBadge";
import { EnforcementActionList } from "@/components/EnforcementActionList";
import { EnforcementPanel } from "@/components/EnforcementPanel";
import { Field } from "@/components/Field";
import { RevealControl } from "@/components/RevealControl";
import { RiskPanel } from "@/components/RiskPanel";
import { Timeline } from "@/components/Timeline";
import { Timestamp } from "@/components/Timestamp";
import { Badge } from "@/components/ui/Badge";
import { TextLink } from "@/components/ui/TextLink";

/** Props of `AccountDetail`. */
export type AccountDetailProps = {
  /** The account and its actions, as the server sent them, with the PII masked. */
  detail: AccountDetailResponse;
};

const panelClasses = "grid grid-cols-2 gap-6 rounded-lg border border-line bg-surface p-6";

/**
 * Lays out one account: its fields, its risk, its enforcement and its
 * timeline. Revealed PII lives in this component's state only, so it is gone
 * when the component leaves the page. Give it a `key` of the account id, so
 * that moving to another account starts masked.
 *
 * @param props - See `AccountDetailProps`.
 */
export function AccountDetail({ detail }: AccountDetailProps): ReactElement {
  const [revealed, setRevealed] = useState<RevealResponse | null>(null);
  const { account, enforcement_actions } = detail;
  // The status and the spam mark come from the query, which stays fresh.
  // Only the PII fields come from the reveal.
  const pii = revealed?.account ?? account;

  return (
    <>
      <div className="flex flex-col gap-2">
        <TextLink to="/accounts">Back to accounts</TextLink>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Account {account.id}</h1>
          <AccountStatusBadge status={account.status} />
          {account.spam_marked_at !== null && <Badge tone="warning">Marked as spam</Badge>}
        </div>
        {!pii.pii_revealed && (
          <p className="text-sm text-ink-muted">
            The server masks the personal data on this page.
          </p>
        )}
        <RevealControl accountId={account.id} revealed={revealed} onRevealed={setRevealed} />
      </div>

      <div className="grid grid-cols-2 items-start gap-8">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="account-heading" className="flex flex-col gap-3">
            <h2 id="account-heading" className="text-lg font-semibold">
              Account
            </h2>
            <dl className={panelClasses}>
              <Field label="Email">{pii.email}</Field>
              <Field label="Plan">{account.plan}</Field>
              <Field label="Created">
                <Timestamp value={account.created_at} />
              </Field>
              <Field label="Marked as spam">
                {account.spam_marked_at === null ? (
                  "No"
                ) : (
                  <Timestamp value={account.spam_marked_at} />
                )}
              </Field>
            </dl>
          </section>

          <section aria-labelledby="signup-heading" className="flex flex-col gap-3">
            <h2 id="signup-heading" className="text-lg font-semibold">
              Signup context
            </h2>
            <dl className={panelClasses}>
              <Field label="IP address">{pii.signup_context.ip}</Field>
              <Field label="Country">{account.signup_context.country}</Field>
              <Field label="Device fingerprint">{pii.signup_context.device_fingerprint}</Field>
              <Field label="User agent">{pii.signup_context.user_agent}</Field>
              <Field label="Referral">{account.signup_context.referral ?? "None"}</Field>
            </dl>
          </section>

          <EnforcementPanel account={account} />
        </div>
        <RiskPanel accountId={account.id} />
      </div>

      <Timeline accountId={account.id} />

      <section aria-labelledby="actions-heading" className="flex flex-col gap-3">
        <h2 id="actions-heading" className="text-lg font-semibold">
          Enforcement actions
        </h2>
        <EnforcementActionList actions={enforcement_actions} />
      </section>
    </>
  );
}
