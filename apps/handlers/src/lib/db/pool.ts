import { createPool } from "mysql2/promise";
import type { Pool } from "mysql2/promise";
import type { Env } from "#app/config/env.ts";

/**
 * Opens the connection pool for the handlers' own database user.
 *
 * @param env - Validated settings.
 * @returns A pool that reads time values as strings and writes them as UTC.
 */
export function create_pool(env: Env): Pool {
  return createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_HANDLERS_USERNAME,
    password: env.DB_HANDLERS_PASSWORD,
    connectionLimit: 5,
    // Rails stores datetime(6). A JavaScript Date keeps milliseconds only, so
    // a keyset cursor built from one would skip or repeat rows.
    dateStrings: true,
    // Any Date bound as a parameter is sent as UTC, whatever the host's zone.
    timezone: "Z",
  });
}
