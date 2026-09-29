import { describe, expect, it } from "@jest/globals";
import { formatTimestamp, formatUtcTimestamp } from "@/lib/format/formatTimestamp";

const value = "2026-09-30T01:02:03.456789Z";

describe("formatTimestamp", () => {
  it("shows the moment in a zone ahead of UTC", () => {
    const text = formatTimestamp(value, { locale: "en-GB", timeZone: "Asia/Manila" });

    expect(text).toContain("30");
    expect(text).toContain("2026");
    expect(text).toContain("09:02:03");
  });

  it("shows the previous day in a zone behind UTC", () => {
    const text = formatTimestamp(value, {
      locale: "en-GB",
      timeZone: "America/Los_Angeles",
    });

    expect(text).toContain("29");
    expect(text).toContain("18:02:03");
  });

  it("returns a value that is not a date unchanged", () => {
    expect(formatTimestamp("not a date")).toBe("not a date");
  });
});

describe("formatUtcTimestamp", () => {
  it("writes the UTC value to the second and drops the fraction", () => {
    expect(formatUtcTimestamp(value)).toBe("2026-09-30 01:02:03 UTC");
  });

  it("returns a value that is not a date unchanged", () => {
    expect(formatUtcTimestamp("")).toBe("");
  });
});
