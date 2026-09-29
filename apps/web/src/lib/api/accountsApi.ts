import {
  account_detail_response_schema,
  account_search_query_schema,
  account_search_response_schema,
  enforcement_result_schema,
} from "@trust-desk/shared";
import type {
  AccountDetailResponse,
  AccountSearchQuery,
  AccountSearchResponse,
  EnforcementRequest,
  EnforcementResult,
} from "@trust-desk/shared";
import { apiRequest } from "@/lib/api/apiRequest";

/**
 * Reads one page of accounts.
 *
 * @param query - No `status` means every status. No `cursor` means the first page. No `limit` means the contract's default.
 * @returns The page, with `next_cursor` null on the last one.
 * @throws {ApiError} When the server refuses the request.
 */
export function searchAccounts(
  query: Partial<AccountSearchQuery>,
): Promise<AccountSearchResponse> {
  return apiRequest({
    method: "GET",
    path: "/api/accounts",
    schema: account_search_response_schema,
    query: account_search_query_schema.parse(query),
  });
}

/**
 * Reads one account with its enforcement actions.
 *
 * @param accountId - The id of the account.
 * @returns The account and its actions, newest first.
 * @throws {ApiError} With `account_not_found` when no account has this id.
 */
export function fetchAccount(accountId: number): Promise<AccountDetailResponse> {
  return apiRequest({
    method: "GET",
    path: `/api/accounts/${accountId}`,
    schema: account_detail_response_schema,
  });
}

/**
 * Suspends one account.
 *
 * @param accountId - The id of the account.
 * @param request - The reason, already trimmed and checked against the contract.
 * @returns The action the server recorded and the account's new status.
 * @throws {ApiError} With `already_suspended` on a 409, and `core_api_unavailable` on a 503.
 */
export function suspendAccount(
  accountId: number,
  request: EnforcementRequest,
): Promise<EnforcementResult> {
  return apiRequest({
    method: "POST",
    path: `/api/accounts/${accountId}/suspend`,
    schema: enforcement_result_schema,
    body: request,
  });
}
