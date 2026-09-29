import { login_request_schema, permissions_for } from "@trust-desk/shared";
import type { SessionResponse } from "@trust-desk/shared";
import { build_set_cookie, issue_session_value } from "#app/lib/auth/session_cookie.ts";
import { client_ip_header } from "#app/lib/http/client_ip.ts";
import { error_response, json_response } from "#app/lib/http/json_response.ts";
import { read_json_body } from "#app/lib/http/read_json_body.ts";
import type { Handler } from "#app/types/handler.ts";

/**
 * `POST /api/login`. Checks an email and a password and starts a session.
 *
 * Failed logins are counted per client IP, never per account. Locking an
 * account would let a stranger lock the demo users out.
 *
 * @returns 200 with the user and the session cookie. 429 with `Retry-After`
 *   when this IP has failed too often. 422 for a malformed body. 401 with
 *   one message for every other failure: the response never says whether
 *   the email or the password was wrong.
 */
export const login: Handler = async (req, deps, context) => {
  const { correlation_id } = context;
  const client_ip = req.headers.get(client_ip_header) ?? "unknown";

  const throttle = deps.login_throttle.check(client_ip);
  if (!throttle.allowed) {
    deps.logger.warn({ correlation_id }, "Login refused: too many failures from this IP.");
    const response = error_response(
      429,
      "rate_limited",
      "Too many failed sign-in attempts. Wait a few minutes and try again.",
      correlation_id,
    );
    response.headers.set("retry-after", String(throttle.retry_after_seconds));
    return response;
  }

  const parsed = await read_json_body(req, login_request_schema);
  if (!parsed.ok) {
    return error_response(
      422,
      "invalid_request",
      "Enter an email and a password.",
      correlation_id,
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
    deps.login_throttle.record_failure(client_ip);
    deps.logger.warn({ correlation_id }, "Login refused.");
    return error_response(
      401,
      "invalid_credentials",
      "The email or the password is wrong.",
      correlation_id,
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
  const response = json_response(body, 200, correlation_id);
  response.headers.append(
    "set-cookie",
    build_set_cookie(
      issue_session_value(deps.config.session_secret, row.id, deps.clock.now()),
      deps.config.secure_cookies,
    ),
  );
  deps.logger.info({ correlation_id, staff_user_id: row.id }, "Login accepted.");
  return response;
};
