import {
  account_detail_response_schema,
  account_search_query_schema,
  account_search_response_schema,
  risk_score_schema,
} from "@trust-desk/shared";
import type {
  AccountDetailResponse,
  AccountSearchQuery,
  AccountSearchResponse,
  RiskScore,
} from "@trust-desk/shared";
import { apiRequest } from "@/lib/api/apiRequest";

/**
 * Reads one page of accounts.
 *
 * @param query - No `status` means every status. No `cursor` means the first page. No `limit` means the contract's default. `email`, `ip` and `fingerprint` need the permission `accounts.search_pii`.
 * @returns The page, with `next_cursor` null on the last one.
 * @throws {ApiError} With `forbidden` when a PII term is sent without the permission.
 * @throws {ZodError} When a term does not fit the contract. Callers check before they call.
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
 * Reads the full risk score of one account, with every signal behind it.
 *
 * @param accountId - The id of the account.
 * @returns The score, its signals in the server's order, and where the counts came from.
 * @throws {ApiError} With `account_not_found` when no account has this id.
 */
export function fetchAccountRisk(accountId: number): Promise<RiskScore> {
  return apiRequest({
    method: "GET",
    path: `/api/accounts/${accountId}/risk`,
    schema: risk_score_schema,
  });
}
