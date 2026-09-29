import { event_type_schema } from "@trust-desk/shared";
import type { Pool } from "mysql2/promise";
import { z } from "zod";
import { run_query } from "#app/lib/db/run_query.ts";
import type { QueryParam } from "#app/lib/db/run_query.ts";
import { mysql_datetime_schema } from "#app/repositories/row_schemas.ts";
import type { EventListArgs, EventRow } from "#app/types/rows.ts";

const row_schema = z.object({
  id: z.number().int().positive(),
  event_type: event_type_schema,
  occurred_at: mysql_datetime_schema,
  occurred_at_raw: z.string(),
  // The driver parses a JSON column before the row reaches this schema.
  payload: z.record(z.string(), z.unknown()),
});

const select = `
  SELECT
    id, event_type, occurred_at,
    CAST(occurred_at AS CHAR) AS occurred_at_raw,
    payload
  FROM events
`;

// The same keyset comparison as the account search, on the index
// (account_id, occurred_at, id).
const after_cursor = "(occurred_at < ? OR (occurred_at = ? AND id < ?))";

/**
 * Lists the events of one account, newest first, starting after a cursor.
 *
 * @param pool - The connection pool.
 * @param args - The account, an optional event type, the position to start
 *   after, and the row limit.
 * @returns At most `limit` rows, each with its raw payload.
 */
export async function list_events(pool: Pool, args: EventListArgs): Promise<EventRow[]> {
  const conditions = ["account_id = ?"];
  const params: QueryParam[] = [args.account_id];

  if (args.event_type !== null) {
    conditions.push("event_type = ?");
    params.push(args.event_type);
  }
  if (args.cursor !== null) {
    conditions.push(after_cursor);
    params.push(args.cursor.at, args.cursor.at, args.cursor.id);
  }

  const sql = `
    ${select}
    WHERE ${conditions.join(" AND ")}
    ORDER BY occurred_at DESC, id DESC
    LIMIT ?
  `;
  params.push(String(args.limit));

  return run_query(pool, sql, params, row_schema);
}
