import type { Pool } from "mysql2/promise";
import { run_query } from "#app/lib/db/run_query.ts";
import {
  staff_credentials_row_schema,
  staff_user_row_schema,
} from "#app/repositories/row_schemas.ts";
import type { StaffCredentialsRow, StaffUserRow } from "#app/types/rows.ts";

const find_credentials_sql = `
  SELECT id, email, display_name, group_name, password_digest
  FROM staff_users
  WHERE email = ?
  LIMIT 1
`;

const find_by_id_sql = `
  SELECT id, email, display_name, group_name
  FROM staff_users
  WHERE id = ?
  LIMIT 1
`;

/**
 * Finds a staff user and the password hash, for login.
 *
 * @param pool - The connection pool.
 * @param email - Compared exactly as stored.
 * @returns The row, or `null` when no user has that email.
 */
export async function find_staff_credentials_by_email(
  pool: Pool,
  email: string,
): Promise<StaffCredentialsRow | null> {
  const rows = await run_query(
    pool,
    find_credentials_sql,
    [email],
    staff_credentials_row_schema,
  );
  return rows[0] ?? null;
}

/**
 * Finds a staff user without the password hash, for an existing session.
 *
 * @param pool - The connection pool.
 * @param id - The staff user id.
 * @returns The row, or `null` when the user does not exist.
 */
export async function find_staff_user_by_id(
  pool: Pool,
  id: number,
): Promise<StaffUserRow | null> {
  const rows = await run_query(pool, find_by_id_sql, [id], staff_user_row_schema);
  return rows[0] ?? null;
}
