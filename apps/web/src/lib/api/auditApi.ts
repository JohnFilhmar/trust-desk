import { audit_log_query_schema, audit_log_response_schema } from "@trust-desk/shared";
import type { AuditLogQuery, AuditLogResponse } from "@trust-desk/shared";
import { apiRequest } from "@/lib/api/apiRequest";

/**
 * Reads the audit trail, newest first.
 *
 * @param query - No `account_id` means every account. No `limit` means the contract's default.
 * @returns The audit entries.
 * @throws {ApiError} When the server refuses the request.
 */
export function fetchAuditLogs(query: Partial<AuditLogQuery>): Promise<AuditLogResponse> {
  return apiRequest({
    method: "GET",
    path: "/api/audit_logs",
    schema: audit_log_response_schema,
    query: audit_log_query_schema.parse(query),
  });
}
