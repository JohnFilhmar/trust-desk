import { account_id_param_schema, reveal_request_schema } from "@trust-desk/shared";
import type { RevealResponse, RevealedField } from "@trust-desk/shared";
import { signed_in_user } from "#app/lib/auth/signed_in_user.ts";
import { error_response, json_response } from "#app/lib/http/json_response.ts";
import { read_json_body } from "#app/lib/http/read_json_body.ts";
import type { Handler } from "#app/types/handler.ts";

/** Every reveal unmasks the same four fields. The audit row lists them by name. */
const revealed_fields: readonly RevealedField[] = [
  "email",
  "signup_ip",
  "device_fingerprint",
  "user_agent",
];

const rejection_messages: Readonly<Record<string, string>> = {
  forbidden: "Your group is not allowed to reveal PII.",
  account_not_found: "No account has that id.",
  invalid_request: "Give a reason of 10 to 500 characters.",
};

/**
 * `POST /api/accounts/:account_id/reveal`. Unmasks the PII of one account,
 * but only after Rails has written the audit row.
 *
 * The order is the point. Rails is asked first. The raw values are put in
 * the response only when Rails answers that the row exists. If Rails is
 * down, slow or refuses, the handler answers without any raw value, so a
 * reveal with no audit row cannot happen on this path.
 *
 * A timeout after Rails has written the row leaves an audit row for a
 * reveal that was never delivered. That over-records, which is the safe
 * direction. There is no retry.
 *
 * @returns 200 with the unmasked account and the id of the audit row. 404
 *   when the account does not exist. 422 for a bad reason. 403 when Rails
 *   refused. 503 when Rails could not be reached, with nothing revealed.
 */
export const reveal_account_pii: Handler = async (req, deps, context) => {
  const { correlation_id } = context;
  const user = signed_in_user(context);

  const id = account_id_param_schema.safeParse(context.params["account_id"]);
  const account = id.success ? await deps.db.find_account_by_id(id.data) : null;
  if (account === null) {
    return error_response(404, "account_not_found", "No account has that id.", correlation_id);
  }

  const parsed = await read_json_body(req, reveal_request_schema);
  if (!parsed.ok) {
    return error_response(
      422,
      "invalid_request",
      "Give a reason of 10 to 500 characters.",
      correlation_id,
    );
  }

  const outcome = await deps.core_api.record_reveal(
    {
      actor_staff_user_id: user.id,
      account_id: account.id,
      reason: parsed.body.reason,
      fields: [...revealed_fields],
    },
    correlation_id,
  );

  if (outcome.kind === "ok") {
    deps.logger.info(
      {
        correlation_id,
        staff_user_id: user.id,
        account_id: account.id,
        audit_log_id: outcome.result.audit_log_id,
      },
      "PII revealed.",
    );
    const body: RevealResponse = {
      account: {
        id: account.id,
        email: account.email,
        status: account.status,
        plan: account.plan,
        spam_marked_at: account.spam_marked_at,
        created_at: account.created_at,
        signup_context: account.signup_context,
        pii_revealed: true,
      },
      audit_log_id: outcome.result.audit_log_id,
    };
    return json_response(body, 200, correlation_id);
  }

  const message =
    outcome.kind === "rejected" ? rejection_messages[outcome.code] : undefined;
  if (outcome.kind === "rejected" && message !== undefined) {
    return error_response(outcome.status, outcome.code, message, correlation_id);
  }

  deps.logger.error(
    { correlation_id, staff_user_id: user.id, account_id: account.id, outcome },
    "Core API call failed. Nothing was revealed.",
  );
  return error_response(
    503,
    "core_api_unavailable",
    "Reveal is unavailable right now, because it could not be recorded. Nothing was revealed.",
    correlation_id,
  );
};
