import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { z } from "zod";
import { build_canonical_request, sign_request } from "#app/lib/core_api/signing.ts";

const vectors_schema = z.object({
  secret: z.string(),
  vectors: z.array(
    z.object({
      name: z.string(),
      method: z.string(),
      path: z.string(),
      timestamp: z.string(),
      nonce: z.string(),
      body: z.string(),
      canonical: z.string(),
      signature: z.string(),
    }),
  ),
});

const fixture = vectors_schema.parse(
  JSON.parse(
    readFileSync(
      join(__dirname, "../../../../../packages/shared/fixtures/signing_vectors.json"),
      "utf8",
    ),
  ),
);

describe("signing, against the vectors the Rails tests also read", () => {
  it("has vectors to check", () => {
    expect(fixture.vectors.length).toBeGreaterThanOrEqual(4);
  });

  it.each(fixture.vectors)("$name", (vector) => {
    expect(build_canonical_request(vector)).toBe(vector.canonical);
    expect(sign_request(fixture.secret, vector)).toBe(vector.signature);
  });
});

describe("sign_request", () => {
  const base = {
    method: "POST",
    path: "/internal/accounts/42/suspend",
    timestamp: "1790726400",
    nonce: "5f0c1b9e-2a3d-4c6f-8e7a-9b0c1d2e3f40",
    body: '{"actor_staff_user_id":3,"reason":"Shared fingerprint cluster."}',
  };
  const secret = "x".repeat(32);

  it("changes when any one part changes", () => {
    const original = sign_request(secret, base);
    expect(sign_request(secret, { ...base, method: "GET" })).not.toBe(original);
    expect(sign_request(secret, { ...base, path: `${base.path}?x=1` })).not.toBe(original);
    expect(sign_request(secret, { ...base, timestamp: "1790726401" })).not.toBe(original);
    expect(sign_request(secret, { ...base, nonce: "another" })).not.toBe(original);
    expect(sign_request(secret, { ...base, body: `${base.body} ` })).not.toBe(original);
    expect(sign_request("y".repeat(32), base)).not.toBe(original);
  });

  it("does not confuse a digit moved from the path to the timestamp", () => {
    const moved = sign_request(secret, { ...base, path: "/a1", timestamp: "23" });
    const other = sign_request(secret, { ...base, path: "/a", timestamp: "123" });
    expect(moved).not.toBe(other);
  });
});
