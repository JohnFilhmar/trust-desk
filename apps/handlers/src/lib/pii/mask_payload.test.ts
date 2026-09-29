import { describe, expect, it } from "@jest/globals";
import { mask_payload, mask_text } from "#app/lib/pii/mask_payload.ts";

describe("mask_payload", () => {
  it("masks the known keys by their own rule", () => {
    expect(
      mask_payload({
        ip: "192.0.2.17",
        source_ip: "198.51.100.4",
        email: "jordan.lee@example.com",
        reporter_email: "sam@example.org",
        device_fingerprint: "fp_a1b2c3d4e5f6",
        user_agent: "Mozilla/5.0 (X11; Linux x86_64)",
      }),
    ).toEqual({
      ip: "192.0.2.xxx",
      source_ip: "198.51.100.xxx",
      email: "j***@example.com",
      reporter_email: "s***@example.org",
      device_fingerprint: "fp_a1b***",
      user_agent: "Mozilla/5.0 ***",
    });
  });

  it("leaves values that are not PII alone", () => {
    const payload = {
      amount_cents: 4900,
      currency: "USD",
      success: false,
      region: "ap-southeast-1",
      cpu_percent: 98.5,
      note: null,
    };
    expect(mask_payload(payload)).toEqual(payload);
  });

  it("finds an email and an IP pasted into free text", () => {
    const masked = mask_payload({
      report: "Phishing page reported by dana@example.com, hosted at 203.0.113.80.",
    });
    expect(masked["report"]).toBe(
      "Phishing page reported by d***@example.com, hosted at 203.0.113.xxx.",
    );
  });

  it("reaches PII nested in objects and arrays", () => {
    const text = JSON.stringify(
      mask_payload({
        request: { headers: { user_agent: "curl/8.5.0 extra" }, ip: "192.0.2.99" },
        recipients: ["a.one@example.com", "b.two@example.org"],
        attempts: [{ ip: "198.51.100.7" }],
      }),
    );
    expect(text).not.toContain("192.0.2.99");
    expect(text).not.toContain("198.51.100.7");
    expect(text).not.toContain("a.one");
    expect(text).not.toContain("b.two");
    expect(text).toContain("192.0.2.xxx");
  });

  it("replaces what lies deeper than it follows, and never passes it on", () => {
    let nested: Record<string, unknown> = { ip: "192.0.2.17" };
    for (let depth = 0; depth < 10; depth += 1) nested = { deeper: nested };

    expect(JSON.stringify(mask_payload(nested))).not.toContain("192.0.2.17");
  });

  it("does not change the payload it was given", () => {
    const payload = { ip: "192.0.2.17", nested: { email: "x.y@example.com" } };
    mask_payload(payload);
    expect(payload).toEqual({ ip: "192.0.2.17", nested: { email: "x.y@example.com" } });
  });
});

describe("mask_text", () => {
  it("leaves text with no address alone", () => {
    expect(mask_text("Version 1.2.3 deployed in 4.5 seconds.")).toBe(
      "Version 1.2.3 deployed in 4.5 seconds.",
    );
  });
});
