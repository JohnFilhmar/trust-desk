import { jest } from "@jest/globals";
import { permissions_for } from "@trust-desk/shared";
import type { SessionUser, StaffGroup } from "@trust-desk/shared";
import type { CoreApi, Database, Deps } from "#app/interfaces/deps.ts";
import { issue_session_value, session_cookie_name } from "#app/lib/auth/session_cookie.ts";
import type { RequestContext } from "#app/types/handler.ts";
import type { AccountRow, StaffUserRow } from "#app/types/rows.ts";

export const test_now = new Date("2026-09-30T00:00:00.000Z");
export const test_session_secret = "s".repeat(32);
export const test_origin = "http://localhost:5173";
export const test_correlation_id = "3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f";

const staff_ids: Readonly<Record<StaffGroup, number>> = {
  viewer: 1,
  analyst: 2,
  enforcer: 3,
};

/** A staff user row for the given group, as the database would return it. */
export function staff_row(group: StaffGroup): StaffUserRow {
  return {
    id: staff_ids[group],
    email: `${group}@example.com`,
    display_name: `Demo ${group}`,
    group_name: group,
  };
}

/** The signed-in user for the given group, as a handler receives it. */
export function session_user(group: StaffGroup): SessionUser {
  return { ...staff_row(group), permissions: permissions_for(group) };
}

/** An account row with raw PII, from the documentation ranges only. */
export function account_row(overrides: Partial<AccountRow> = {}): AccountRow {
  return {
    id: 42,
    email: "jordan.lee@example.com",
    status: "active",
    plan: "pro",
    spam_marked_at: null,
    created_at: "2026-09-29T01:02:03.456789Z",
    created_at_raw: "2026-09-29 01:02:03.456789",
    signup_context: {
      ip: "192.0.2.17",
      country: "PH",
      user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0",
      device_fingerprint: "fp_a1b2c3d4e5f6",
      referral: null,
    },
    ...overrides,
  };
}

/**
 * Builds the dependencies for a handler test.
 *
 * @param db - The queries this test cares about. The rest return nothing.
 * @param core_api - The Rails calls this test cares about.
 * @returns Dependencies with a fixed clock, a silent logger, a password
 *   checker that accepts only the text `correct`, and a Rails client that
 *   reports Rails as unavailable unless told otherwise.
 */
export function fake_deps(
  db: Partial<Database> = {},
  core_api: Partial<CoreApi> = {},
): Deps {
  return {
    db: {
      ping: async () => true,
      find_staff_credentials_by_email: async () => null,
      find_staff_user_by_id: async () => null,
      search_accounts: async () => [],
      find_account_by_id: async () => null,
      list_enforcement_actions: async () => [],
      list_audit_logs: async () => [],
      ...db,
    },
    auth: {
      verify_password: async (password, digest) =>
        digest !== null && password === "correct",
    },
    core_api: {
      suspend_account: async () => ({ kind: "unavailable", reason: "not set up" }),
      ...core_api,
    },
    clock: { now: () => test_now },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    config: {
      session_secret: test_session_secret,
      allowed_origins: [test_origin],
      secure_cookies: true,
    },
  };
}

/**
 * Builds the per-request context for a handler called directly.
 *
 * @param user - The signed-in user, or `null` for a public route.
 * @param params - Path parameters the route would have captured.
 * @returns A context with a fixed correlation id.
 */
export function fake_context(
  user: SessionUser | null = null,
  params: Record<string, string> = {},
): RequestContext {
  return { correlation_id: test_correlation_id, params, user };
}

/**
 * Builds a request the way the console would send it, for tests that go
 * through the router.
 *
 * @param method - The HTTP method.
 * @param path - The path with its query string.
 * @param options - `as` signs the request in as that group. `body` is sent
 *   as JSON. `origin` replaces the Origin header, and `null` leaves it out.
 * @returns A request carrying a valid session cookie when `as` is given.
 */
export function console_request(
  method: string,
  path: string,
  options: { as?: StaffGroup; body?: unknown; origin?: string | null } = {},
): Request {
  const headers = new Headers({ "x-correlation-id": test_correlation_id });
  const origin = options.origin === undefined ? test_origin : options.origin;
  if (origin !== null) headers.set("origin", origin);
  if (options.as !== undefined) {
    const value = issue_session_value(
      test_session_secret,
      staff_ids[options.as],
      test_now,
    );
    headers.set("cookie", `${session_cookie_name}=${value}`);
  }
  if (options.body !== undefined) headers.set("content-type", "application/json");

  return new Request(`http://localhost${path}`, {
    method,
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
}

/** A database whose staff lookup knows the three demo users by id. */
export function staff_lookup(): Pick<Database, "find_staff_user_by_id"> {
  const groups: StaffGroup[] = ["viewer", "analyst", "enforcer"];
  return {
    find_staff_user_by_id: async (id) =>
      groups.map(staff_row).find((row) => row.id === id) ?? null,
  };
}
