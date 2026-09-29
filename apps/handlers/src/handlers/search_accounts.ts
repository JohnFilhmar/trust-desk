import { account_search_query_schema, has_permission } from "@trust-desk/shared";
import type { AccountSearchResponse } from "@trust-desk/shared";
import { present_masked_summary } from "#app/lib/accounts/present_account.ts";
import { signed_in_user } from "#app/lib/auth/signed_in_user.ts";
import { error_response, json_response } from "#app/lib/http/json_response.ts";
import { current_mode_name } from "#app/lib/modes/present_mode.ts";
import { cut_page, decode_cursor } from "#app/lib/pagination/cursor.ts";
import { quick_risk, window_start_day } from "#app/lib/risk/load_risk.ts";
import { risk_config } from "#app/lib/risk/risk_config.ts";
import type { Handler } from "#app/types/handler.ts";

/**
 * `GET /api/accounts`. Lists accounts newest first, one page at a time.
 *
 * A search by email, IP or fingerprint needs `accounts.search_pii`. Without
 * that rule, masking would hide nothing: a viewer could type a guess and
 * learn from the result count whether it was right.
 *
 * @returns 200 with the page, a quick risk score per row, and
 *   `next_cursor`. 403 when the search names a PII field and the user may
 *   not search by one. 422 for a bad filter, limit or cursor.
 */
export const search_accounts: Handler = async (req, deps, context) => {
  const { correlation_id } = context;
  const user = signed_in_user(context);

  const query = account_search_query_schema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  const cursor =
    query.success && query.data.cursor !== undefined
      ? decode_cursor(query.data.cursor)
      : null;
  if (!query.success || (query.data.cursor !== undefined && cursor === null)) {
    return error_response(
      422,
      "invalid_request",
      "The search could not be read.",
      correlation_id,
    );
  }

  const { limit, status, email, ip, fingerprint } = query.data;
  const searches_pii = email !== undefined || ip !== undefined || fingerprint !== undefined;
  if (searches_pii && !has_permission(user.group_name, "accounts.search_pii")) {
    deps.logger.warn(
      { correlation_id, staff_user_id: user.id },
      "Search by PII refused.",
    );
    return error_response(
      403,
      "forbidden",
      "Your group may search by status only, not by email, IP or fingerprint.",
      correlation_id,
    );
  }

  const rows = await deps.db.search_accounts({
    status: status ?? null,
    email: email ?? null,
    ip: ip ?? null,
    fingerprint: fingerprint ?? null,
    cursor,
    limit: limit + 1,
  });
  const { page, next_cursor } = cut_page(rows, limit, (row) => ({
    at: row.created_at_raw,
    id: row.id,
  }));

  const [mode, risk_rows] = await Promise.all([
    current_mode_name(deps.db),
    deps.db.list_quick_risk(
      page.map((row) => row.id),
      window_start_day(deps.clock.now()),
      risk_config.signup_velocity.window_minutes,
    ),
  ]);
  const risk_by_account = new Map(risk_rows.map((row) => [row.account_id, row]));

  const body: AccountSearchResponse = {
    items: page.map((row) =>
      present_masked_summary(row, quick_risk(risk_by_account.get(row.id), row, mode)),
    ),
    next_cursor,
  };
  return json_response(body, 200, correlation_id);
};
