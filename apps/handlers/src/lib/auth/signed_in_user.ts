import type { SessionUser } from "@trust-desk/shared";
import type { RequestContext } from "#app/types/handler.ts";

/**
 * Reads the signed-in user inside a handler whose route is not public.
 *
 * @param context - The request context the router built.
 * @returns The user the router already authorized.
 * @throws {Error} When the user is missing. That means a route was declared
 *   `public` by mistake, and the router turns the error into a 500.
 */
export function signed_in_user(context: RequestContext): SessionUser {
  if (context.user === null) {
    throw new Error("A handler that needs a user ran on a public route.");
  }
  return context.user;
}
