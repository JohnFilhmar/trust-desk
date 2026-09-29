import { z } from "zod";
import type { KeysetCursor } from "#app/types/rows.ts";

const cursor_schema = z.object({
  at: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/),
  id: z.number().int().positive(),
});

/**
 * Packs the position of a row into an opaque string.
 *
 * @param cursor - The ordering timestamp and the id of the last row of a page.
 * @returns base64url text. It is opaque so that callers do not build their
 *   own, not because it is secret.
 */
export function encode_cursor(cursor: KeysetCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

/**
 * Unpacks a cursor sent by a caller.
 *
 * @param value - The text from the `cursor` query parameter.
 * @returns The position, or `null` when the text is not a cursor this
 *   service made. The values are bound as query parameters, so a forged
 *   cursor can only move the page, never change the query.
 */
export function decode_cursor(value: string): KeysetCursor | null {
  try {
    const raw: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const parsed = cursor_schema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Cuts one page out of the rows a query returned, and builds the cursor
 * for the next one. The query is asked for one row more than the page
 * holds. When that extra row comes back, there is a next page.
 *
 * @param rows - What the query returned, at most `page_size + 1` rows.
 * @param page_size - How many rows a page holds.
 * @param position - Reads the ordering timestamp and the id of a row.
 * @returns The page, and the cursor pointing at its last row, or `null` on
 *   the last page.
 */
export function cut_page<Row>(
  rows: readonly Row[],
  page_size: number,
  position: (row: Row) => KeysetCursor,
): { page: Row[]; next_cursor: string | null } {
  const page = rows.slice(0, page_size);
  const last = page.at(-1);
  const has_more = rows.length > page_size && last !== undefined;
  return { page, next_cursor: has_more ? encode_cursor(position(last)) : null };
}
