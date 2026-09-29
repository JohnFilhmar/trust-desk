import { describe, expect, it } from "@jest/globals";
import { health_response_schema } from "@trust-desk/shared";
import { health } from "#app/handlers/health.ts";
import { fake_context, fake_deps } from "#app/test_utils/fake_deps.ts";

const request = new Request("http://localhost/api/health");

describe("GET /api/health", () => {
  it("answers 200 with the shared schema when MySQL is up", async () => {
    const res = await health(request, fake_deps(), fake_context());
    expect(res.status).toBe(200);
    expect(health_response_schema.parse(await res.json())).toEqual({
      status: "ok",
      database: "up",
    });
  });

  it("answers 503 when MySQL is down", async () => {
    const deps = fake_deps({ ping: async () => false });
    const res = await health(request, deps, fake_context());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "degraded", database: "down" });
  });

  it("echoes the correlation id and forbids caching", async () => {
    const res = await health(request, fake_deps(), fake_context());
    expect(res.headers.get("x-correlation-id")).toBe(
      fake_context().correlation_id,
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
