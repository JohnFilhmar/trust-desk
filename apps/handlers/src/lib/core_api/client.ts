import { randomUUID } from "node:crypto";
import {
  enforcement_result_schema,
  error_envelope_schema,
  internal_mode_change_result_schema,
  internal_reveal_result_schema,
} from "@trust-desk/shared";
import type { EnforcementActionType } from "@trust-desk/shared";
import type { z } from "zod";
import type { Clock, CoreApi, CoreApiResult } from "#app/interfaces/deps.ts";
import { sign_request } from "#app/lib/core_api/signing.ts";

/** Rails gets this long to answer. There is no retry. */
const timeout_ms = 3000;

const enforcement_paths: Readonly<Record<EnforcementActionType, string>> = {
  suspend: "suspend",
  unsuspend: "unsuspend",
  mark_spam: "mark_spam",
};

export type CoreApiSettings = {
  /** Such as `http://core-api:3000`, with no trailing slash. */
  base_url: string;
  secret: string;
  clock: Clock;
  /** Injected so tests can stand in for the network. Defaults to the global `fetch`. */
  fetch_fn?: typeof fetch;
};

/** Sends one signed POST and sorts the answer into the three cases callers handle. */
async function signed_post<Result>(
  settings: CoreApiSettings,
  path: string,
  payload: unknown,
  correlation_id: string,
  result_schema: z.ZodType<Result>,
): Promise<CoreApiResult<Result>> {
  // The body is turned into text once. The same text is hashed for the
  // signature and sent on the wire, so the two cannot differ.
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(settings.clock.now().getTime() / 1000).toString();
  const nonce = randomUUID();
  const signature = sign_request(settings.secret, {
    method: "POST",
    path,
    timestamp,
    nonce,
    body,
  });

  let response: Response;
  try {
    response = await (settings.fetch_fn ?? fetch)(`${settings.base_url}${path}`, {
      method: "POST",
      body,
      headers: {
        "content-type": "application/json",
        "x-correlation-id": correlation_id,
        "x-signature": signature,
        "x-signature-timestamp": timestamp,
        "x-signature-nonce": nonce,
      },
      signal: AbortSignal.timeout(timeout_ms),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.name : "unknown";
    return { kind: "unavailable", reason: `network: ${reason}` };
  }

  let parsed_body: unknown;
  try {
    parsed_body = await response.json();
  } catch {
    return { kind: "unavailable", reason: `status ${response.status}, body not JSON` };
  }

  // 200 is what Rails answers when it replays a stored response for an
  // idempotency key it has seen before.
  if (response.status === 201 || response.status === 200) {
    const result = result_schema.safeParse(parsed_body);
    return result.success
      ? { kind: "ok", result: result.data }
      : { kind: "unavailable", reason: "success body did not fit the contract" };
  }

  // 401 means this service signed badly or its clock is off. That is a
  // fault in the deployment, not something the analyst did, so it is
  // reported as unavailable along with every 5xx.
  const envelope = error_envelope_schema.safeParse(parsed_body);
  const refused_on_merits = [403, 404, 409, 422].includes(response.status);
  if (envelope.success && refused_on_merits) {
    return {
      kind: "rejected",
      status: response.status,
      code: envelope.data.error.code,
    };
  }
  return { kind: "unavailable", reason: `status ${response.status}` };
}

/**
 * Builds the client for the signed calls to Rails.
 *
 * @param settings - Where Rails is, the shared secret, and the clock.
 * @returns A client whose methods never throw.
 */
export function create_core_api(settings: CoreApiSettings): CoreApi {
  return {
    enforce(action, account_id, body, correlation_id) {
      return signed_post(
        settings,
        `/internal/accounts/${account_id}/${enforcement_paths[action]}`,
        body,
        correlation_id,
        enforcement_result_schema,
      );
    },
    record_reveal(body, correlation_id) {
      return signed_post(
        settings,
        "/internal/reveals",
        body,
        correlation_id,
        internal_reveal_result_schema,
      );
    },
    change_mode(body, correlation_id) {
      return signed_post(
        settings,
        "/internal/operational_modes",
        body,
        correlation_id,
        internal_mode_change_result_schema,
      );
    },
  };
}
