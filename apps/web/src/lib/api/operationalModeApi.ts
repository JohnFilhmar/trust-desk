import { operational_mode_schema } from "@trust-desk/shared";
import type { ModeChangeRequest, OperationalMode } from "@trust-desk/shared";
import { apiRequest } from "@/lib/api/apiRequest";

/**
 * Reads the operational mode in force.
 *
 * @returns The mode, who set it, and what it changes.
 * @throws {ApiError} With status 401 when nobody is signed in.
 */
export function fetchOperationalMode(): Promise<OperationalMode> {
  return apiRequest({
    method: "GET",
    path: "/api/operational_mode",
    schema: operational_mode_schema,
  });
}

/**
 * Changes the operational mode.
 *
 * @param request - The new mode and the reason, already checked against the contract.
 * @returns The mode now in force.
 * @throws {ApiError} With `mode_unchanged` on a 409 when the mode is already in force, and `core_api_unavailable` on a 503.
 */
export function changeOperationalMode(request: ModeChangeRequest): Promise<OperationalMode> {
  return apiRequest({
    method: "POST",
    path: "/api/operational_mode",
    schema: operational_mode_schema,
    body: request,
  });
}
