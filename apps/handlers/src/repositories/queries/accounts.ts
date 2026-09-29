import type { Pool } from "mysql2/promise";
import { run_query } from "#app/lib/db/run_query.ts";
import type { QueryParam } from "#app/lib/db/run_query.ts";
import { account_row_schema } from "#app/repositories/row_schemas.ts";
import type { AccountRow, AccountSearchArgs } from "#app/types/rows.ts";

// created_at is selected twice. One copy becomes ISO 8601 for the response.
// The other stays exactly as MySQL wrote it, for the cursor.
const columns = `
  id, email, status, plan, spam_marked_at, created_at,
  CAST(created_at AS CHAR) AS created_at_raw,
  signup_context
`;

const status_filter = "status = ?";

// A leading wildcard means MySQL reads every row. That is fine for the few
// hundred accounts of this demo. At real volume this filter would need a
// full-text index or a search service.
const email_filter = "email LIKE ? ESCAPE '\\\\'";

// signup_ip and signup_fingerprint are generated columns. MySQL computes
// each from the signup_context JSON and keeps an index on it, so these two
// filters are index lookups and the JSON is never parsed per row.
const ip_filter = "signup_ip = ?";
const fingerprint_filter = "signup_fingerprint = ?";

// Keyset pagination. "Everything after this row" in an order of
// created_at DESC, id DESC means an older created_at, or the same
// created_at and a smaller id. Written out this way, MySQL can walk the
// index on (status, created_at, id) and stop after LIMIT rows. An OFFSET
// would make it read and throw away every row before the page.
const after_cursor = "(created_at < ? OR (created_at = ? AND id < ?))";

const find_by_id_sql = `SELECT ${columns} FROM accounts WHERE id = ? LIMIT 1`;

/**
 * Makes a search term safe to put between the wildcards of a LIKE.
 *
 * @param term - What the analyst typed.
 * @returns The term with `%`, `_` and the backslash escaped, so each one
 *   matches itself and cannot widen the search.
 */
export function escape_like(term: string): string {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/**
 * Lists accounts newest first, starting after a cursor.
 *
 * @param pool - The connection pool.
 * @param args - The filters, the position to start after, and the row limit.
 * @returns At most `limit` rows. The SQL text is assembled from the fixed
 *   fragments above. Every value a caller sent is bound as a parameter.
 */
export async function search_accounts(
  pool: Pool,
  args: AccountSearchArgs,
): Promise<AccountRow[]> {
  const conditions: string[] = [];
  const params: QueryParam[] = [];

  if (args.status !== null) {
    conditions.push(status_filter);
    params.push(args.status);
  }
  if (args.email !== null) {
    conditions.push(email_filter);
    params.push(`%${escape_like(args.email)}%`);
  }
  if (args.ip !== null) {
    conditions.push(ip_filter);
    params.push(args.ip);
  }
  if (args.fingerprint !== null) {
    conditions.push(fingerprint_filter);
    params.push(args.fingerprint);
  }
  if (args.cursor !== null) {
    conditions.push(after_cursor);
    params.push(args.cursor.at, args.cursor.at, args.cursor.id);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `
    SELECT ${columns}
    FROM accounts
    ${where}
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `;
  // MySQL 8 refuses a numeric LIMIT in a prepared statement, so it is bound as text.
  params.push(String(args.limit));

  return run_query(pool, sql, params, account_row_schema);
}

/**
 * Finds one account.
 *
 * @param pool - The connection pool.
 * @param id - The account id.
 * @returns The row with raw PII, or `null` when the account does not exist.
 */
export async function find_account_by_id(
  pool: Pool,
  id: number,
): Promise<AccountRow | null> {
  const rows = await run_query(pool, find_by_id_sql, [id], account_row_schema);
  return rows[0] ?? null;
}
