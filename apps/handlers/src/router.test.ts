import { describe, expect, it } from "@jest/globals";
import { error_envelope_schema } from "@trust-desk/shared";
import { dispatch, match_pattern } from "#app/router.ts";
import type { Route } from "#app/router.ts";
import { fake_deps } from "#app/test_utils/fake_deps.ts";

describe("match_pattern", () => {
  it("captures a named segment", () => {
    expect(match_pattern("/api/accounts/:account_id", "/api/accounts/42")).toEqual(
      { account_id: "42" },
    );
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
    const res = await dispatch(new Request("http://localhost/api/nope"), fake_deps());
    expect(res.status).toBe(404);
    expect(error_envelope_schema.parse(await res.json()).error.code).toBe(
      "not_found",
    );
  });

  it("turns a thrown error into a generic 500 and logs the detail", async () => {
    const table: Route[] = [
      {
        method: "GET",
        pattern: "/api/boom",
        handler: async () => {
          throw new Error("SELECT secret FROM somewhere failed");
        },
      },
    ];
    const deps = fake_deps();

    const res = await dispatch(new Request("http://localhost/api/boom"), deps, table);
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
      new Request("http://localhost/api/health", { method: "POST" }),
      fake_deps(),
    );
    expect(res.status).toBe(404);
  });
});
