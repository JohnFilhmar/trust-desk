import { z } from "zod";

// The pages a visitor can be sent back to, and nothing else: /accounts,
// /accounts/<digits> and /audit, each with an optional query string made of
// characters that cannot start a new address.
//
// This is a list of what is allowed, not a list of what is refused. The
// first version refused "//" and let "/\" through, which browsers read as
// "//". A list of bad patterns is only as good as the last trick someone
// thought of.
const ownPage = /^\/(?:accounts(?:\/\d+)?|audit)(?:\?[A-Za-z0-9_=&%.+-]*)?$/;

const returnStateSchema = z.object({
  returnPath: z.string().max(500).regex(ownPage),
});

/** Where a visitor lands when no valid return path was kept. */
export const defaultReturnPath = "/accounts";

/**
 * Reads the page a visitor asked for before they were sent to sign in.
 *
 * @param state - The router's `location.state`, which can hold anything.
 * @returns The return path when it is one of this console's own pages,
 *   otherwise the accounts page. It never returns a value that could take
 *   the visitor to another site.
 */
export function readReturnPath(state: unknown): string {
  const parsed = returnStateSchema.safeParse(state);
  return parsed.success ? parsed.data.returnPath : defaultReturnPath;
}
