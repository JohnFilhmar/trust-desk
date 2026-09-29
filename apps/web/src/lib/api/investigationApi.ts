import {
  event_list_response_schema,
  event_query_schema,
  reveal_response_schema,
} from "@trust-desk/shared";
import type {
  EventListResponse,
  EventQuery,
  RevealRequest,
  RevealResponse,
} from "@trust-desk/shared";
import { apiRequest } from "@/lib/api/apiRequest";

/**
 * Reads one page of an account's timeline, newest first.
 *
 * @param accountId - The id of the account.
 * @param query - No `event_type` means every type. No `cursor` means the first page. No `limit` means the contract's default.
 * @returns The page, with `next_cursor` null on the last one. Payloads arrive masked.
 * @throws {ApiError} With `account_not_found` when no account has this id.
 */
export function fetchAccountEvents(
  accountId: number,
  query: Partial<EventQuery>,
): Promise<EventListResponse> {
  return apiRequest({
    method: "GET",
    path: `/api/accounts/${accountId}/events`,
    schema: event_list_response_schema,
    query: event_query_schema.parse(query),
  });
}

/**
 * Asks the server to unmask the PII of one account. The server writes an
 * audit row before it answers.
 *
 * @param accountId - The id of the account.
 * @param request - The reason, already trimmed and checked against the contract.
 * @returns The account with `pii_revealed` true, and the id of the audit row. The caller keeps it in memory only.
 * @throws {ApiError} With `forbidden` without the permission `pii.reveal`, and `core_api_unavailable` on a 503.
 */
export function revealAccountPii(
  accountId: number,
  request: RevealRequest,
): Promise<RevealResponse> {
  return apiRequest({
    method: "POST",
    path: `/api/accounts/${accountId}/reveal`,
    schema: reveal_response_schema,
    body: request,
  });
}
