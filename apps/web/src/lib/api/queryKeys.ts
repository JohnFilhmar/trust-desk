import type { AccountStatus } from "@trust-desk/shared";
import type { QueryKey } from "@tanstack/react-query";

/**
 * Builds the key of the session query.
 *
 * @returns The key.
 */
export function sessionKey(): QueryKey {
  return ["session"];
}

/**
 * Builds a key under `accounts`. The arguments narrow it from every account
 * query, to the lists, to one list or one account.
 *
 * @param scope - `list` or `detail`. When absent, the key matches every account query.
 * @param value - The status of a list, or the id of an account. When absent, a list key stands for every status.
 * @returns The key.
 */
export function accountsKey(
  scope?: "list" | "detail",
  value?: AccountStatus | number,
): QueryKey {
  if (scope === undefined) {
    return ["accounts"];
  }
  return ["accounts", scope, value ?? "all"];
}

/**
 * Builds the key of the audit trail query.
 *
 * @returns The key.
 */
export function auditLogsKey(): QueryKey {
  return ["audit_logs"];
}
