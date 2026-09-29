import { jest } from "@jest/globals";
import type { Database, Deps } from "#app/interfaces/deps.ts";
import type { RequestContext } from "#app/types/handler.ts";

/**
 * Builds the dependencies for a handler test.
 *
 * @param db - The queries this test cares about. The rest keep a safe default.
 * @returns Dependencies with a fixed clock and a silent logger.
 */
export function fake_deps(db: Partial<Database> = {}): Deps {
  return {
    db: { ping: async () => true, ...db },
    clock: { now: () => new Date("2026-09-30T00:00:00.000Z") },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  };
}

/**
 * Builds the per-request context for a handler test.
 *
 * @param params - Path parameters the route would have captured.
 * @returns A context with a fixed correlation id.
 */
export function fake_context(params: Record<string, string> = {}): RequestContext {
  return { correlation_id: "3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f", params };
}
