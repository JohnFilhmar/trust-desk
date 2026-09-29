import { describe, expect, it } from "@jest/globals";
import { error_envelope_schema } from "@trust-desk/shared";
import type { StaffGroup } from "@trust-desk/shared";
import { dispatch, match_pattern } from "#app/router.ts";
import { routes } from "#app/routes.ts";
import {
  console_request,
  fake_deps,
  staff_lookup,
} from "#app/test_utils/fake_deps.ts";
import type { Route } from "#app/types/handler.ts";

async function error_code(res: Response): Promise<string> {
  return error_envelope_schema.parse(await res.json()).error.code;
}

describe("match_pattern", () => {
  it("captures a named segment", () => {
    expect(match_pattern("/api/accounts/:account_id", "/api/accounts/42")).toEqual({
      account_id: "42",
    });
  });

  it("rejects a path with a different number of segments", () => {
    expect(match_pattern("/api/accounts/:account_id", "/api/accounts")).toBeNull();
    expect(
      match_pattern("/api/accounts/:account_id", "/api/accounts/42/events"),
    ).toBeNull();
  });

  it("rejects an empty value for a named segment", () => {
    expect(match_pattern("/api/accounts/:account_id", "/api/accounts/")).toBeNull();
  });
});

describe("dispatch", () => {
  it("answers 404 in the shared error shape for an unknown path", async () => {
    const res = await dispatch(console_request("GET", "/api/nope"), fake_deps());
    expect(res.status).toBe(404);
    expect(await error_code(res)).toBe("not_found");
  });

  it("turns a thrown error into a generic 500 and logs the detail", async () => {
    const table: Route[] = [
      {
        method: "GET",
        pattern: "/api/boom",
        access: "public",
        handler: async () => {
          throw new Error("SELECT secret FROM somewhere failed");
        },
      },
    ];
    const deps = fake_deps();

    const res = await dispatch(console_request("GET", "/api/boom"), deps, table);
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).not.toContain("SELECT");
    expect(error_envelope_schema.parse(JSON.parse(text)).error.code).toBe(
      "internal_error",
    );
    expect(deps.logger.error).toHaveBeenCalledTimes(1);
  });

  it("does not match a route on the wrong method", async () => {
    const res = await dispatch(
      console_request("DELETE", "/api/health"),
      fake_deps(),
    );
    expect(res.status).toBe(404);
  });
});

describe("the origin check", () => {
  it("refuses a POST from another origin before anything else runs", async () => {
    const deps = fake_deps(staff_lookup());
    const res = await dispatch(
      console_request("POST", "/api/accounts/42/suspend", {
        as: "enforcer",
        origin: "https://evil.example.org",
        body: { reason: "Shared fingerprint cluster." },
      }),
      deps,
    );
    expect(res.status).toBe(403);
    expect(await error_code(res)).toBe("origin_not_allowed");
  });

  it("refuses a POST with no Origin header", async () => {
    const res = await dispatch(
      console_request("POST", "/api/logout", { origin: null }),
      fake_deps(),
    );
    expect(res.status).toBe(403);
  });

  it("lets a GET through with no Origin header", async () => {
    const res = await dispatch(
      console_request("GET", "/api/health", { origin: null }),
      fake_deps(),
    );
    expect(res.status).toBe(200);
  });
});

describe("access to every route", () => {
  const protected_routes = routes.filter((route) => route.access !== "public");

  it("keeps the list of public routes short and known", () => {
    const open = routes
      .filter((route) => route.access === "public")
      .map((route) => `${route.method} ${route.pattern}`);
    expect(open.sort()).toEqual(
      ["GET /api/health", "POST /api/login", "POST /api/logout"].sort(),
    );
  });

  it.each(protected_routes)(
    "$method $pattern answers 401 with no session",
    async (route) => {
      const path = route.pattern.replace(":account_id", "42");
      const res = await dispatch(console_request(route.method, path), fake_deps());
      expect(res.status).toBe(401);
      expect(await error_code(res)).toBe("unauthenticated");
    },
  );

  it("answers 401 when the session names a staff user who no longer exists", async () => {
    const res = await dispatch(
      console_request("GET", "/api/session", { as: "viewer" }),
      fake_deps({ find_staff_user_by_id: async () => null }),
    );
    expect(res.status).toBe(401);
  });

  const cannot_enforce: StaffGroup[] = ["viewer", "analyst"];
  it.each(cannot_enforce)(
    "answers 403 when a %s tries to suspend, and never calls Rails",
    async (group) => {
      let called = false;
      const deps = fake_deps(staff_lookup(), {
        enforce: async () => {
          called = true;
          return { kind: "unavailable", reason: "should not be reached" };
        },
      });
      const res = await dispatch(
        console_request("POST", "/api/accounts/42/suspend", {
          as: group,
          body: { reason: "Shared fingerprint cluster." },
        }),
        deps,
      );
      expect(res.status).toBe(403);
      expect(await error_code(res)).toBe("forbidden");
      expect(called).toBe(false);
    },
  );
});
