import { account_id_param_schema, event_query_schema } from "@trust-desk/shared";
import type { AccountEvent, EventListResponse } from "@trust-desk/shared";
import { error_response, json_response } from "#app/lib/http/json_response.ts";
import { cut_page, decode_cursor } from "#app/lib/pagination/cursor.ts";
import { mask_payload } from "#app/lib/pii/mask_payload.ts";
import type { Handler } from "#app/types/handler.ts";

/**
 * `GET /api/accounts/:account_id/events`. Shows the timeline of one
 * account, newest first, one page at a time.
 *
 * Every payload is masked. A payload is free-form JSON and can hold an IP
 * or an email under any key, so it goes through the same masking module as
 * the account fields.
 *
 * @returns 200 with the page and `next_cursor`. 404 when the account does
 *   not exist. 422 for a bad event type, limit or cursor.
 */
export const list_account_events: Handler = async (req, deps, context) => {
  const { correlation_id } = context;

  const id = account_id_param_schema.safeParse(context.params["account_id"]);
  const account = id.success ? await deps.db.find_account_by_id(id.data) : null;
  if (account === null) {
    return error_response(404, "account_not_found", "No account has that id.", correlation_id);
  }

  const query = event_query_schema.safeParse(
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
      "The timeline filter could not be read.",
      correlation_id,
    );
  }

  const rows = await deps.db.list_events({
    account_id: account.id,
    event_type: query.data.event_type ?? null,
    cursor,
    limit: query.data.limit + 1,
  });
  const { page, next_cursor } = cut_page(rows, query.data.limit, (row) => ({
    at: row.occurred_at_raw,
    id: row.id,
  }));

  const body: EventListResponse = {
    items: page.map(
      (row): AccountEvent => ({
        id: row.id,
        event_type: row.event_type,
        occurred_at: row.occurred_at,
        payload: mask_payload(row.payload),
      }),
    ),
    next_cursor,
  };
  return json_response(body, 200, correlation_id);
};
