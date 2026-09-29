import { enforcement_action_type_schema } from "@trust-desk/shared";
import type { EnforcementAction } from "@trust-desk/shared";
import type { Pool } from "mysql2/promise";
import { z } from "zod";
import { run_query } from "#app/lib/db/run_query.ts";
import { mysql_datetime_schema } from "#app/repositories/row_schemas.ts";

const row_schema = z.object({
  id: z.number().int().positive(),
  account_id: z.number().int().positive(),
  staff_user_id: z.number().int().positive(),
  action_type: enforcement_action_type_schema,
  reason: z.string(),
  correlation_id: z.uuid(),
  created_at: mysql_datetime_schema,
});

const list_sql = `
  SELECT id, account_id, staff_user_id, action_type, reason, correlation_id, created_at
  FROM enforcement_actions
  WHERE account_id = ?
  ORDER BY created_at DESC, id DESC
  LIMIT 100
`;

/**
 * Lists the actions taken against one account, newest first.
 *
 * @param pool - The connection pool.
 * @param account_id - The account id.
 * @returns At most 100 actions. An empty array when there are none.
 */
export async function list_enforcement_actions(
  pool: Pool,
  account_id: number,
): Promise<EnforcementAction[]> {
  return run_query(pool, list_sql, [account_id], row_schema);
}
