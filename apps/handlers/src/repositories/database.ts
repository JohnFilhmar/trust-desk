import type { Pool } from "mysql2/promise";
import type { Database } from "#app/interfaces/deps.ts";
import { find_account_by_id, search_accounts } from "#app/repositories/queries/accounts.ts";
import { list_audit_logs } from "#app/repositories/queries/audit_logs.ts";
import { list_enforcement_actions } from "#app/repositories/queries/enforcement_actions.ts";
import {
  find_staff_credentials_by_email,
  find_staff_user_by_id,
} from "#app/repositories/queries/staff_users.ts";

/**
 * Builds the read-side queries on top of a pool.
 *
 * @param pool - The connection pool of the handlers' database user.
 * @returns The named queries that handlers receive through `deps.db`.
 */
export function create_database(pool: Pool): Database {
  return {
    async ping(): Promise<boolean> {
      try {
        await pool.query("SELECT 1");
        return true;
      } catch {
        return false;
      }
    },
    find_staff_credentials_by_email: (email) =>
      find_staff_credentials_by_email(pool, email),
    find_staff_user_by_id: (id) => find_staff_user_by_id(pool, id),
    search_accounts: (args) => search_accounts(pool, args),
    find_account_by_id: (id) => find_account_by_id(pool, id),
    list_enforcement_actions: (account_id) => list_enforcement_actions(pool, account_id),
    list_audit_logs: (args) => list_audit_logs(pool, args),
  };
}
