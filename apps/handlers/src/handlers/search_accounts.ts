import { account_search_query_schema } from "@trust-desk/shared";
import type { AccountSearchResponse } from "@trust-desk/shared";
import { decode_cursor, encode_cursor } from "#app/lib/accounts/cursor.ts";
import { present_masked_summary } from "#app/lib/accounts/present_account.ts";
import { error_response, json_response } from "#app/lib/http/json_response.ts";
import type { Handler } from "#app/types/handler.ts";

/**
 * `GET /api/accounts`. Lists accounts newest first, one page at a time.
 *
 * It asks the database for one row more than the page holds. When that
 * extra row comes back there is a next page, and the cursor points at the
 * last row shown.
 *
 * @returns 200 with the page and `next_cursor`, or 422 for a bad filter,
 *   limit or cursor.
 */
export const search_accounts: Handler = async (req, deps, context) => {
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
      context.correlation_id,
    );
  }

  const { limit, status } = query.data;
  const rows = await deps.db.search_accounts({
    status: status ?? null,
    cursor,
    limit: limit + 1,
  });

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const has_more = rows.length > limit && last !== undefined;

  const body: AccountSearchResponse = {
    items: page.map(present_masked_summary),
    next_cursor: has_more
      ? encode_cursor({ created_at: last.created_at_raw, id: last.id })
      : null,
  };
  return json_response(body, 200, context.correlation_id);
};
