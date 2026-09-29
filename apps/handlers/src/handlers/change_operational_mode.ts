import { mode_change_request_schema } from "@trust-desk/shared";
import { signed_in_user } from "#app/lib/auth/signed_in_user.ts";
import { error_response, json_response } from "#app/lib/http/json_response.ts";
import { read_json_body } from "#app/lib/http/read_json_body.ts";
import { present_mode } from "#app/lib/modes/present_mode.ts";
import type { Handler } from "#app/types/handler.ts";

const rejection_messages: Readonly<Record<string, string>> = {
  forbidden: "Your group is not allowed to do this.",
  mode_unchanged: "The console is already in that mode.",
  invalid_request: "Pick a mode and give a reason of 10 to 500 characters.",
};

/**
 * `POST /api/operational_mode`. Asks Rails to change the mode. The
 * handlers write nothing themselves.
 *
 * @returns 201 with the mode now in force. 409 when the console is already
 *   in that mode. 422 for a bad mode or reason. 503 when Rails could not be
 *   reached, in which case the mode did not change as far as this service
 *   knows.
 */
export const change_operational_mode: Handler = async (req, deps, context) => {
  const { correlation_id } = context;
  const user = signed_in_user(context);

  const parsed = await read_json_body(req, mode_change_request_schema);
  if (!parsed.ok) {
    return error_response(
      422,
      "invalid_request",
      "Pick a mode and give a reason of 10 to 500 characters.",
      correlation_id,
    );
  }

  const outcome = await deps.core_api.change_mode(
    { ...parsed.body, actor_staff_user_id: user.id },
    correlation_id,
  );

  if (outcome.kind === "ok") {
    deps.logger.info(
      {
        correlation_id,
        staff_user_id: user.id,
        mode: outcome.result.operational_mode.mode,
      },
      "Operational mode changed.",
    );
    // The row is read back, so the response is what every other request
    // will see from now on, and not what this one hoped to write.
    return json_response(
      present_mode(await deps.db.find_current_mode()),
      201,
      correlation_id,
    );
  }

  const message =
    outcome.kind === "rejected" ? rejection_messages[outcome.code] : undefined;
  if (outcome.kind === "rejected" && message !== undefined) {
    return error_response(outcome.status, outcome.code, message, correlation_id);
  }

  deps.logger.error(
    { correlation_id, staff_user_id: user.id, outcome },
    "Core API call failed.",
  );
  return error_response(
    503,
    "core_api_unavailable",
    "Mode changes are unavailable right now. The mode did not change. Try again shortly.",
    correlation_id,
  );
};
