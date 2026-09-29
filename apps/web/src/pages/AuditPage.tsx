import { useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { AuditDetails } from "@/components/AuditDetails";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { ForbiddenState } from "@/components/ForbiddenState";
import { LoadingState } from "@/components/LoadingState";
import { Timestamp } from "@/components/Timestamp";
import { TextLink } from "@/components/ui/TextLink";
import { auditLogsKey } from "@/lib/api/queryKeys";
import { auditActionLabels } from "@/lib/format/labels";
import { useApiClient } from "@/providers/ApiClientProvider";
import { useSession } from "@/providers/SessionProvider";

const headerCellClasses = "px-4 py-3 text-left text-xs font-medium text-ink-muted";
const cellClasses = "px-4 py-3 text-sm align-top";

/**
 * Shows the audit trail, newest first. A user without `audit.read` sees the
 * forbidden state and no request is sent.
 */
export function AuditPage(): ReactElement {
  const apiClient = useApiClient();
  const { can } = useSession();
  const canReadAudit = can("audit.read");

  const auditQuery = useQuery({
    queryKey: auditLogsKey(),
    queryFn: () => apiClient.fetchAuditLogs({}),
    enabled: canReadAudit,
  });

  return (
    <>
      <h1 className="text-2xl font-semibold">Audit trail</h1>
      {!canReadAudit && <ForbiddenState />}
      {canReadAudit && auditQuery.isPending && <LoadingState label="Loading the audit trail" />}
      {auditQuery.isError && (
        <ErrorState error={auditQuery.error} heading="The audit trail could not be loaded" />
      )}
      {auditQuery.isSuccess && auditQuery.data.items.length === 0 && (
        <EmptyState
          heading="The audit trail is empty"
          message="An entry appears here each time a staff user acts on an account."
        />
      )}
      {auditQuery.isSuccess && auditQuery.data.items.length > 0 && (
        <table className="w-full rounded-lg border border-line bg-surface">
          <caption className="sr-only">Audit trail, newest first</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={headerCellClasses}>
                Time
              </th>
              <th scope="col" className={headerCellClasses}>
                Staff user
              </th>
              <th scope="col" className={headerCellClasses}>
                Action
              </th>
              <th scope="col" className={headerCellClasses}>
                Account
              </th>
              <th scope="col" className={headerCellClasses}>
                Details
              </th>
            </tr>
          </thead>
          <tbody>
            {auditQuery.data.items.map((entry) => (
              <tr key={entry.id} className="border-b border-line last:border-b-0">
                <td className={cellClasses}>
                  <Timestamp value={entry.created_at} />
                </td>
                <td className={cellClasses}>{entry.actor.display_name}</td>
                <td className={cellClasses}>{auditActionLabels[entry.action]}</td>
                <td className={cellClasses}>
                  {entry.account_id !== null && (
                    <TextLink to={`/accounts/${entry.account_id}`}>
                      Account {entry.account_id}
                    </TextLink>
                  )}
                </td>
                <td className={cellClasses}>
                  <AuditDetails details={entry.details} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
