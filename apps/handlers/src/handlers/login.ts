import { login_request_schema, permissions_for } from "@trust-desk/shared";
import type { SessionResponse } from "@trust-desk/shared";
import { build_set_cookie, issue_session_value } from "#app/lib/auth/session_cookie.ts";
import { error_response, json_response } from "#app/lib/http/json_response.ts";
import { read_json_body } from "#app/lib/http/read_json_body.ts";
import type { Handler } from "#app/types/handler.ts";

/**
 * `POST /api/login`. Checks an email and a password and starts a session.
 *
 * @returns 200 with the user and the session cookie, 422 for a malformed
 *   body, or 401 with one message for every other failure. The response
 *   never says whether the email or the password was wrong.
 */
export const login: Handler = async (req, deps, context) => {
  const parsed = await read_json_body(req, login_request_schema);
  if (!parsed.ok) {
    return error_response(
      422,
      "invalid_request",
      "Enter an email and a password.",
      context.correlation_id,
    );
  }

  const row = await deps.db.find_staff_credentials_by_email(parsed.body.email);
  // The password is checked even when no user matched, so an unknown email
  // takes as long to refuse as a wrong password.
  const matches = await deps.auth.verify_password(
    parsed.body.password,
    row?.password_digest ?? null,
  );

  if (row === null || !matches) {
    deps.logger.warn({ correlation_id: context.correlation_id }, "Login refused.");
    return error_response(
      401,
      "invalid_credentials",
      "The email or the password is wrong.",
      context.correlation_id,
    );
  }

  const body: SessionResponse = {
    user: {
      id: row.id,
      email: row.email,
      display_name: row.display_name,
      group_name: row.group_name,
      permissions: permissions_for(row.group_name),
    },
  };
  const response = json_response(body, 200, context.correlation_id);
  response.headers.append(
    "set-cookie",
    build_set_cookie(
      issue_session_value(deps.config.session_secret, row.id, deps.clock.now()),
      deps.config.secure_cookies,
    ),
  );
  deps.logger.info(
    { correlation_id: context.correlation_id, staff_user_id: row.id },
    "Login accepted.",
  );
  return response;
};
