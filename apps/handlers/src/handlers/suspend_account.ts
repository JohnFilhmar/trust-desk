import { account_id_param_schema, enforcement_request_schema } from "@trust-desk/shared";
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
  invalid_request: "Give a reason of 10 to 500 characters.",
};

/**
 * `POST /api/accounts/:account_id/suspend`. Asks Rails to suspend an
 * account. The handlers write nothing themselves.
 *
 * The router has already checked `accounts.enforce`. Rails checks it again
 * from the staff user id inside the signed body.
 *
 * @returns 201 with what Rails recorded. 404, 409, 422 or 403 when Rails
 *   refused on the merits. 503 when Rails could not be reached or answered
 *   with anything unexpected, in which case nothing was suspended as far as
 *   this service knows.
 */
export const suspend_account: Handler = async (req, deps, context) => {
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

  const parsed = await read_json_body(req, enforcement_request_schema);
  if (!parsed.ok) {
    return error_response(
      422,
      "invalid_request",
      "Give a reason of 10 to 500 characters.",
      correlation_id,
    );
  }

  const outcome = await deps.core_api.suspend_account(
    id.data,
    { actor_staff_user_id: user.id, reason: parsed.body.reason },
    correlation_id,
  );

  if (outcome.kind === "ok") {
    deps.logger.info(
      { correlation_id, staff_user_id: user.id, account_id: id.data },
      "Account suspended.",
    );
    return json_response(outcome.result, 201, correlation_id);
  }

  const message =
    outcome.kind === "rejected" ? rejection_messages[outcome.code] : undefined;
  if (outcome.kind === "rejected" && message !== undefined) {
    return error_response(outcome.status, outcome.code, message, correlation_id);
  }

  deps.logger.error(
    { correlation_id, staff_user_id: user.id, account_id: id.data, outcome },
    "Core API call failed.",
  );
  return error_response(
    503,
    "core_api_unavailable",
    "Enforcement is unavailable right now. Nothing was changed. Try again shortly.",
    correlation_id,
  );
};
