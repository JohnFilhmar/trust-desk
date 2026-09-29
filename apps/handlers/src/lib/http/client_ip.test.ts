import { describe, expect, it } from "@jest/globals";
import { is_trusted_proxy, resolve_client_ip } from "#app/lib/http/client_ip.ts";

describe("is_trusted_proxy", () => {
  it.each(["127.0.0.1", "::1", "10.0.0.5", "172.18.0.4", "172.31.255.1", "192.168.1.1", "::ffff:172.18.0.4"])(
    "trusts %s",
    (address) => {
      expect(is_trusted_proxy(address)).toBe(true);
    },
  );

  it.each(["203.0.113.9", "172.15.0.1", "172.32.0.1", "192.0.2.1", "2001:db8::1", "unknown", ""])(
    "does not trust %s",
    (address) => {
      expect(is_trusted_proxy(address)).toBe(false);
    },
  );
});

describe("resolve_client_ip", () => {
  it("believes the header when the connection came from the proxy", () => {
    expect(resolve_client_ip("172.18.0.4", "203.0.113.9")).toBe("203.0.113.9");
  });

  it("ignores the header when the connection came from anywhere else", () => {
    expect(resolve_client_ip("203.0.113.50", "192.0.2.1")).toBe("203.0.113.50");
  });

  it("falls back to the connection when the header is missing or not an IP", () => {
    expect(resolve_client_ip("172.18.0.4", null)).toBe("172.18.0.4");
    expect(resolve_client_ip("172.18.0.4", "not-an-ip")).toBe("172.18.0.4");
    expect(resolve_client_ip("172.18.0.4", "203.0.113.9, 10.0.0.1")).toBe("172.18.0.4");
  });

  it("never returns an empty value", () => {
    expect(resolve_client_ip(undefined, null)).toBe("unknown");
  });
});
