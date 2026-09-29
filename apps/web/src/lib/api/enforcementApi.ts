import { enforcement_result_schema } from "@trust-desk/shared";
import type {
  EnforcementActionType,
  EnforcementRequest,
  EnforcementResult,
} from "@trust-desk/shared";
import { apiRequest } from "@/lib/api/apiRequest";

// The contract names each path after its action type.
function enforce(
  actionType: EnforcementActionType,
  accountId: number,
  request: EnforcementRequest,
  idempotencyKey: string,
): Promise<EnforcementResult> {
  return apiRequest({
    method: "POST",
    path: `/api/accounts/${accountId}/${actionType}`,
    schema: enforcement_result_schema,
    body: request,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

/**
 * Suspends one account.
 *
 * @param accountId - The id of the account.
 * @param request - The reason, already trimmed and checked against the contract.
 * @param idempotencyKey - A UUID. The same key with the same reason acts once, however often it is sent.
 * @returns The action the server recorded and the account's new status.
 * @throws {ApiError} With `already_suspended` on a 409, `idempotency_key_reused` on a 422, and `core_api_unavailable` on a 503.
 */
export function suspendAccount(
  accountId: number,
  request: EnforcementRequest,
  idempotencyKey: string,
): Promise<EnforcementResult> {
  return enforce("suspend", accountId, request, idempotencyKey);
}

/**
 * Lifts the suspension of one account.
 *
 * @param accountId - The id of the account.
 * @param request - The reason, already trimmed and checked against the contract.
 * @param idempotencyKey - A UUID. The same key with the same reason acts once, however often it is sent.
 * @returns The action the server recorded and the account's new status.
 * @throws {ApiError} With `not_suspended` or `blocked_by_lockdown` on a 409, and `core_api_unavailable` on a 503.
 */
export function unsuspendAccount(
  accountId: number,
  request: EnforcementRequest,
  idempotencyKey: string,
): Promise<EnforcementResult> {
  return enforce("unsuspend", accountId, request, idempotencyKey);
}

/**
 * Marks one account as spam.
 *
 * @param accountId - The id of the account.
 * @param request - The reason, already trimmed and checked against the contract.
 * @param idempotencyKey - A UUID. The same key with the same reason acts once, however often it is sent.
 * @returns The action the server recorded, with the time the account was marked.
 * @throws {ApiError} With `already_marked_spam` on a 409, and `core_api_unavailable` on a 503.
 */
export function markAccountAsSpam(
  accountId: number,
  request: EnforcementRequest,
  idempotencyKey: string,
): Promise<EnforcementResult> {
  return enforce("mark_spam", accountId, request, idempotencyKey);
}
