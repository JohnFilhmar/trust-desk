import type { Pool } from "mysql2/promise";
import { z } from "zod";

/** The values mysql2 accepts as a bound parameter in this codebase. */
export type QueryParam = string | number | null;

/**
 * Runs one prepared statement and validates every row it returns.
 *
 * @param pool - The connection pool.
 * @param sql - A statement with `?` placeholders. Never built from user input.
 * @param params - One value per placeholder. Pass a `LIMIT` as a string:
 *   MySQL 8 rejects a numeric one in a prepared statement.
 * @param row_schema - The shape one row must have.
 * @returns The rows, typed by the schema. An empty result is an empty array.
 * @throws {z.ZodError} When a row does not fit the schema.
 */
export async function run_query<Row>(
  pool: Pool,
  sql: string,
  params: readonly QueryParam[],
  row_schema: z.ZodType<Row>,
): Promise<Row[]> {
  // The driver's own row types are a claim, not a check. Treating the result
  // as unknown forces every row through the schema.
  const [rows]: [unknown, unknown] = await pool.execute(sql, [...params]);
  return z.array(row_schema).parse(rows);
}
