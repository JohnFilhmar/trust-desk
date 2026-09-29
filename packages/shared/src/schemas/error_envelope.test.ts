import { describe, expect, it } from "@jest/globals";
import { error_envelope_schema } from "./error_envelope.ts";

describe("error_envelope_schema", () => {
  it("accepts a code, a message and a UUID correlation id", () => {
    const parsed = error_envelope_schema.safeParse({
      error: {
        code: "not_found",
        message: "Not found.",
        correlation_id: "3f2b6c1e-8d4a-4b7e-9c55-0a1b2c3d4e5f",
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a correlation id that is not a UUID", () => {
    const parsed = error_envelope_schema.safeParse({
      error: { code: "not_found", message: "Not found.", correlation_id: "abc" },
    });
    expect(parsed.success).toBe(false);
  });
});
