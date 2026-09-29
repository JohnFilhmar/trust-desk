import type { EventType } from "@trust-desk/shared";
import type { QueryKey } from "@tanstack/react-query";
import { accountsKey } from "@/lib/api/queryKeys";

/**
 * Builds the key of one account's risk query. It sits under the account's
 * detail key, so refreshing the account refreshes the risk too.
 *
 * @param accountId - The id of the account.
 * @returns The key.
 */
export function accountRiskKey(accountId: number): QueryKey {
  return [...accountsKey("detail", accountId), "risk"];
}

/**
 * Builds the key of one account's timeline query.
 *
 * @param accountId - The id of the account.
 * @param eventType - The type the timeline is filtered by. When absent, the key stands for every type.
 * @returns The key.
 */
export function accountEventsKey(accountId: number, eventType: EventType | undefined): QueryKey {
  return [...accountsKey("detail", accountId), "events", eventType ?? "all"];
}

/**
 * Builds the key of the operational mode query.
 *
 * @returns The key.
 */
export function operationalModeKey(): QueryKey {
  return ["operational_mode"];
}
