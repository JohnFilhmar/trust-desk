import { describe, expect, it } from "@jest/globals";
import { create_login_throttle } from "#app/lib/rate_limit/login_throttle.ts";

function throttle_at(start: string, overrides: { max_tracked_ips?: number } = {}) {
  let now = new Date(start).getTime();
  const throttle = create_login_throttle({
    max_failures: 3,
    window_seconds: 60,
    max_tracked_ips: overrides.max_tracked_ips ?? 100,
    clock: { now: () => new Date(now) },
  });
  return {
    throttle,
    advance: (seconds: number) => {
      now += seconds * 1000;
    },
  };
}

const ip = "192.0.2.10";
const other_ip = "198.51.100.20";

describe("login throttle", () => {
  it("allows an IP with no failures", () => {
    const { throttle } = throttle_at("2026-09-30T00:00:00Z");
    expect(throttle.check(ip)).toEqual({ allowed: true });
  });

  it("refuses the IP once it reaches the limit", () => {
    const { throttle } = throttle_at("2026-09-30T00:00:00Z");
    throttle.record_failure(ip);
    throttle.record_failure(ip);
    expect(throttle.check(ip).allowed).toBe(true);

    throttle.record_failure(ip);
    expect(throttle.check(ip)).toEqual({ allowed: false, retry_after_seconds: 60 });
  });

  it("counts each IP by itself, so one visitor cannot lock out another", () => {
    const { throttle } = throttle_at("2026-09-30T00:00:00Z");
    for (let index = 0; index < 3; index += 1) throttle.record_failure(ip);

    expect(throttle.check(ip).allowed).toBe(false);
    expect(throttle.check(other_ip)).toEqual({ allowed: true });
  });

  it("says how long to wait, counted from the oldest failure", () => {
    const { throttle, advance } = throttle_at("2026-09-30T00:00:00Z");
    throttle.record_failure(ip);
    advance(20);
    throttle.record_failure(ip);
    throttle.record_failure(ip);
    advance(10);

    expect(throttle.check(ip)).toEqual({ allowed: false, retry_after_seconds: 30 });
  });

  it("allows the IP again when the oldest failure leaves the window", () => {
    const { throttle, advance } = throttle_at("2026-09-30T00:00:00Z");
    for (let index = 0; index < 3; index += 1) throttle.record_failure(ip);

    advance(59);
    expect(throttle.check(ip).allowed).toBe(false);
    advance(1);
    expect(throttle.check(ip)).toEqual({ allowed: true });
  });

  it("forgets the oldest IP when it is full, and keeps working", () => {
    const { throttle } = throttle_at("2026-09-30T00:00:00Z", { max_tracked_ips: 2 });
    for (let index = 0; index < 3; index += 1) throttle.record_failure("192.0.2.1");
    throttle.record_failure("192.0.2.2");
    throttle.record_failure("192.0.2.3");

    expect(throttle.check("192.0.2.1")).toEqual({ allowed: true });
    expect(throttle.check("192.0.2.3").allowed).toBe(true);
  });
});
