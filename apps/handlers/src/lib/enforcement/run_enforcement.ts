import { account_id_param_schema, enforcement_request_schema } from "@trust-desk/shared";
import type { EnforcementActionType } from "@trust-desk/shared";
import { z } from "zod";
import { signed_in_user } from "#app/lib/auth/signed_in_user.ts";
import { error_response, json_response } from "#app/lib/http/json_response.ts";
import { read_json_body } from "#app/lib/http/read_json_body.ts";
import type { Handler } from "#app/types/handler.ts";

// What the console is told for each code Rails can refuse with. Rails' own
// message is never passed on, so nothing internal can reach a browser.
const rejection_messages: Readonly<Record<string, string>> = {
  forbidden: "Your group is not allowed to do this.",
  account_not_found: "No account has that id.",
  already_suspended: "This account is already suspended.",
  not_suspended: "This account is not suspended.",
  already_marked_spam: "This account is already marked as spam.",
  blocked_by_lockdown: "Unsuspend is switched off while the console is in lockdown.",
  invalid_request: "Give a reason of 10 to 500 characters.",
  idempotency_key_reused:
    "This request was already sent with different details. Close the dialog and start again.",
};

const log_messages: Readonly<Record<EnforcementActionType, string>> = {
  suspend: "Account suspended.",
  unsuspend: "Account unsuspended.",
  mark_spam: "Account marked as spam.",
};

const idempotency_key_schema = z.uuid();

/**
 * Builds the handler of one enforcement action. Suspend, unsuspend and mark
 * as spam differ only in the path they call on Rails.
 *
 * The handlers write nothing themselves. The router has already checked
 * `accounts.enforce`, and Rails checks it again from the staff user id
 * inside the signed body.
 *
 * @param action - Which action the handler performs.
 * @returns A handler that answers 201 with what Rails recorded, also when
 *   Rails replayed the stored response of a repeated idempotency key. 403,
 *   404, 409 or 422 when Rails refused on the merits. 422 for an `Idempotency-Key` that is not a UUID.
 *   503 when Rails could not be reached, in which case nothing was changed
 *   as far as this service knows.
 */
export function create_enforcement_handler(action: EnforcementActionType): Handler {
  return async (req, deps, context) => {
    const { correlation_id } = context;
    const user = signed_in_user(context);

    const id = account_id_param_schema.safeParse(context.params["account_id"]);
    if (!id.success) {
      return error_response(
        404,
        "account_not_found",
        "No account has that id.",
        correlation_id,
      );
    }

    const header = req.headers.get("idempotency-key");
    const key = header === null ? null : idempotency_key_schema.safeParse(header);
    const parsed = await read_json_body(req, enforcement_request_schema);
    if (!parsed.ok || (key !== null && !key.success)) {
      return error_response(
        422,
        "invalid_request",
        "Give a reason of 10 to 500 characters.",
        correlation_id,
      );
    }

    const outcome = await deps.core_api.enforce(
      action,
      id.data,
      {
        actor_staff_user_id: user.id,
        reason: parsed.body.reason,
        idempotency_key: key === null ? null : key.data,
      },
      correlation_id,
    );

    if (outcome.kind === "ok") {
      deps.logger.info(
        { correlation_id, staff_user_id: user.id, account_id: id.data, action },
        log_messages[action],
      );
      return json_response(outcome.result, 201, correlation_id);
    }

    const message =
      outcome.kind === "rejected" ? rejection_messages[outcome.code] : undefined;
    if (outcome.kind === "rejected" && message !== undefined) {
      return error_response(outcome.status, outcome.code, message, correlation_id);
    }

    deps.logger.error(
      { correlation_id, staff_user_id: user.id, account_id: id.data, action, outcome },
      "Core API call failed.",
    );
    return error_response(
      503,
      "core_api_unavailable",
      "Enforcement is unavailable right now. Nothing was changed. Try again shortly.",
      correlation_id,
    );
  };
}
