import { z } from "zod";
import type { AccountCursor } from "#app/types/rows.ts";

const cursor_schema = z.object({
  created_at: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/),
  id: z.number().int().positive(),
});

/**
 * Packs the position of a row into an opaque string.
 *
 * @param cursor - The `created_at` and `id` of the last row of a page.
 * @returns base64url text. It is opaque so that callers do not build their
 *   own, not because it is secret.
 */
export function encode_cursor(cursor: AccountCursor): string {
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
export function decode_cursor(value: string): AccountCursor | null {
  try {
    const raw: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const parsed = cursor_schema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
