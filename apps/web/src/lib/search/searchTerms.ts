import { account_search_query_schema } from "@trust-desk/shared";
import type { z } from "zod";

const searchTermsSchema = account_search_query_schema.pick({
  email: true,
  ip: true,
  fingerprint: true,
});

/** The three PII terms an account search can carry. Each one is optional. */
export type SearchTerms = z.infer<typeof searchTermsSchema>;

/** The names of the three PII terms, in the order the form shows them. */
export const searchTermNames = searchTermsSchema.keyof().options;

/**
 * Checks PII search terms against the contract.
 *
 * @param values - What a person typed or what the address holds, by term name. An empty or missing value counts as no term. Other names are ignored.
 * @returns The trimmed terms, or null when a term is shorter than 2 or longer than 100 characters.
 */
export function parseSearchTerms(
  values: Readonly<Record<string, string | null | undefined>>,
): SearchTerms | null {
  const candidate: Record<string, string> = {};
  for (const name of searchTermNames) {
    const value = values[name]?.trim() ?? "";
    if (value !== "") {
      candidate[name] = value;
    }
  }
  const parsed = searchTermsSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
