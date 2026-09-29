import { describe, expect, it } from "@jest/globals";
import { resolve_correlation_id } from "#app/lib/http/correlation_id.ts";

const uuid_pattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("resolve_correlation_id", () => {
  it("keeps a valid UUID", () => {
    const id = "3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f";
    expect(resolve_correlation_id(id)).toBe(id);
  });

  it("creates a UUID when the header is missing", () => {
    expect(resolve_correlation_id(null)).toMatch(uuid_pattern);
  });

  it("replaces free text, so nothing arbitrary reaches the logs", () => {
    const forged = 'x" level=error msg="forged line';
    const id = resolve_correlation_id(forged);
    expect(id).not.toBe(forged);
    expect(id).toMatch(uuid_pattern);
  });
});
