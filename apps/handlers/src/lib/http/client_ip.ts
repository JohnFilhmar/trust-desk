import { isIP } from "node:net";

/** The header the Node adapter writes the resolved client IP into. */
export const client_ip_header = "x-td-client-ip";

/** The header host nginx writes the browser's address into. */
export const real_ip_header = "x-real-ip";

/**
 * Tells whether an address belongs to a proxy this service trusts. Host
 * nginx and the development proxy reach the container over loopback or a
 * private Docker network. Nothing on the public internet can, since the
 * container publishes its port on 127.0.0.1 only.
 *
 * @param address - The address of the machine that opened the connection.
 * @returns `true` for loopback and the private IPv4 ranges, in plain form
 *   or mapped into IPv6.
 */
export function is_trusted_proxy(address: string): boolean {
  const plain = address.startsWith("::ffff:") ? address.slice(7) : address;
  if (plain === "::1") return true;
  if (isIP(plain) !== 4) return false;

  const [first = -1, second = -1] = plain.split(".").map(Number);
  return (
    first === 127 ||
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

/**
 * Works out the address of the browser behind a request.
 *
 * @param remote_address - Who opened the connection, or `undefined` when
 *   Node does not know.
 * @param forwarded - The value of `X-Real-IP`, or `null` when it is absent.
 * @returns The forwarded address, but only when the connection came from a
 *   trusted proxy and the header holds a valid IP. Otherwise the address of
 *   the connection itself. A caller who is not the proxy cannot choose its
 *   own address by sending the header, so it cannot dodge the login throttle
 *   or pin its failures on someone else.
 */
export function resolve_client_ip(
  remote_address: string | undefined,
  forwarded: string | null,
): string {
  const remote = remote_address ?? "unknown";
  if (!is_trusted_proxy(remote)) return remote;
  if (forwarded !== null && isIP(forwarded.trim()) !== 0) return forwarded.trim();
  return remote;
}
