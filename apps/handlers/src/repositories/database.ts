import type { Pool } from "mysql2/promise";
import type { Database } from "#app/interfaces/deps.ts";

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
  };
}
