import { describe, expect, it } from "@jest/globals";
import {
  mask_email,
  mask_fingerprint,
  mask_ip,
  mask_user_agent,
} from "#app/lib/pii/mask.ts";

describe("mask_email", () => {
  it("keeps the first character and the domain", () => {
    expect(mask_email("jordan.lee@example.com")).toBe("j***@example.com");
  });

  it("gives the same length of mask for a short and a long name", () => {
    expect(mask_email("al@example.org")).toBe("a***@example.org");
  });

  it.each(["", "no-at-sign", "@example.com"])("masks %p whole", (value) => {
    expect(mask_email(value)).toBe("***");
  });
});

describe("mask_ip", () => {
  it("hides the last part of an IPv4 address", () => {
    expect(mask_ip("192.0.2.17")).toBe("192.0.2.xxx");
  });

  it.each(["2001:db8::1", "", "192.0.2", "192.0.2.17.4", "a.b.c.d"])(
    "masks %p whole",
    (value) => {
      expect(mask_ip(value)).toBe("***");
    },
  );
});

describe("mask_fingerprint", () => {
  it("keeps six characters, so a shared fingerprint still looks shared", () => {
    expect(mask_fingerprint("fp_a1b2c3d4e5f6")).toBe("fp_a1b***");
    expect(mask_fingerprint("fp_a1b2c3d4e5f6")).toBe(mask_fingerprint("fp_a1b2c3d4e5f6"));
  });

  it("masks a short value whole, since six characters would be all of it", () => {
    expect(mask_fingerprint("fp_a1b")).toBe("***");
  });
});

describe("mask_user_agent", () => {
  it("keeps the product token only", () => {
    expect(
      mask_user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0"),
    ).toBe("Mozilla/5.0 ***");
  });

  it("masks a value with no space whole", () => {
    expect(mask_user_agent("curl/8.5.0")).toBe("***");
  });
});
