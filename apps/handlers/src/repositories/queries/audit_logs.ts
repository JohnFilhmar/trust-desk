import { audit_action_schema } from "@trust-desk/shared";
import type { AuditLogEntry } from "@trust-desk/shared";
import type { Pool } from "mysql2/promise";
import { z } from "zod";
import { run_query } from "#app/lib/db/run_query.ts";
import type { QueryParam } from "#app/lib/db/run_query.ts";
import { mysql_datetime_schema } from "#app/repositories/row_schemas.ts";
import type { AuditLogArgs } from "#app/types/rows.ts";

// The query returns flat columns. The transform gives them the nested
// shape of the contract, so the actor is an object and not two fields.
const row_schema = z
  .object({
    id: z.number().int().positive(),
    action: audit_action_schema,
    actor_id: z.number().int().positive(),
    actor_display_name: z.string(),
    account_id: z.number().int().positive().nullable(),
    details: z.record(z.string(), z.unknown()),
    correlation_id: z.uuid(),
    created_at: mysql_datetime_schema,
  })
  .transform(({ actor_id, actor_display_name, ...rest }) => ({
    ...rest,
    actor: { id: actor_id, display_name: actor_display_name },
  }));

const select = `
  SELECT
    audit_logs.id,
    audit_logs.action,
    audit_logs.staff_user_id AS actor_id,
    staff_users.display_name AS actor_display_name,
    audit_logs.account_id,
    audit_logs.details,
    audit_logs.correlation_id,
    audit_logs.created_at
  FROM audit_logs
  INNER JOIN staff_users ON staff_users.id = audit_logs.staff_user_id
`;

const order = "ORDER BY audit_logs.created_at DESC, audit_logs.id DESC LIMIT ?";

const list_all_sql = `${select} ${order}`;
const list_for_account_sql = `${select} WHERE audit_logs.account_id = ? ${order}`;

/**
 * Lists audit rows, newest first.
 *
 * @param pool - The connection pool.
 * @param args - An account to filter by, or `null` for every row, and the limit.
 * @returns At most `limit` rows.
 */
export async function list_audit_logs(
  pool: Pool,
  args: AuditLogArgs,
): Promise<AuditLogEntry[]> {
  const limit = String(args.limit);
  const sql = args.account_id === null ? list_all_sql : list_for_account_sql;
  const params: QueryParam[] =
    args.account_id === null ? [limit] : [args.account_id, limit];
  return run_query(pool, sql, params, row_schema);
}
