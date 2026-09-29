import { operational_mode_name_schema } from "@trust-desk/shared";
import type { Pool } from "mysql2/promise";
import { z } from "zod";
import { run_query } from "#app/lib/db/run_query.ts";
import { mysql_datetime_schema } from "#app/repositories/row_schemas.ts";
import type { CurrentModeRow } from "#app/types/rows.ts";

const row_schema = z.object({
  mode: operational_mode_name_schema,
  reason: z.string(),
  staff_user_id: z.number().int().positive(),
  display_name: z.string(),
  created_at: mysql_datetime_schema,
});

// The table only ever grows. The current mode is its newest row.
const current_mode_sql = `
  SELECT
    operational_modes.mode,
    operational_modes.reason,
    operational_modes.staff_user_id,
    staff_users.display_name,
    operational_modes.created_at
  FROM operational_modes
  INNER JOIN staff_users ON staff_users.id = operational_modes.staff_user_id
  ORDER BY operational_modes.created_at DESC, operational_modes.id DESC
  LIMIT 1
`;

/**
 * Reads the operational mode in force.
 *
 * @param pool - The connection pool.
 * @returns The newest row with the name of who wrote it, or `null` when the
 *   table is empty. The caller treats an empty table as `normal`.
 */
export async function find_current_mode(pool: Pool): Promise<CurrentModeRow | null> {
  const rows = await run_query(pool, current_mode_sql, [], row_schema);
  return rows[0] ?? null;
}
