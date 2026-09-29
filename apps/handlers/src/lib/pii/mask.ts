/**
 * Every masking rule, in one module. A value that leaves this service
 * without being revealed goes through one of these functions first.
 */

const masked = "***";

/**
 * Masks an email address.
 *
 * @param email - The raw address.
 * @returns The first character and the domain, such as `j***@example.com`.
 *   The domain stays because a disposable domain is itself a risk signal.
 *   A value with no `@` is masked whole.
 */
export function mask_email(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return masked;
  return `${email.slice(0, 1)}${masked}${email.slice(at)}`;
}

/**
 * Masks an IP address.
 *
 * @param ip - The raw address, IPv4 or IPv6.
 * @returns An IPv4 address keeps its first three parts, such as `192.0.2.xxx`,
 *   which is enough to see that two accounts share a network. Anything else,
 *   IPv6 included, is masked whole.
 */
export function mask_ip(ip: string): string {
  const parts = ip.split(".");
  const is_ipv4 = parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part));
  if (!is_ipv4) return masked;
  return `${parts.slice(0, 3).join(".")}.xxx`;
}

/**
 * Masks a device fingerprint.
 *
 * @param fingerprint - The raw fingerprint.
 * @returns The first six characters, such as `fp_a1b***`. Two accounts that
 *   share a fingerprint still look alike, but the value cannot be reused.
 *   A value of six characters or fewer is masked whole.
 */
export function mask_fingerprint(fingerprint: string): string {
  if (fingerprint.length <= 6) return masked;
  return `${fingerprint.slice(0, 6)}${masked}`;
}

/**
 * Masks a user agent.
 *
 * @param user_agent - The raw header value.
 * @returns The product token before the first space, such as `Mozilla/5.0 ***`.
 *   The rest, which holds the operating system and exact versions, is dropped.
 */
export function mask_user_agent(user_agent: string): string {
  const space = user_agent.indexOf(" ");
  if (space === -1) return masked;
  return `${user_agent.slice(0, space)} ${masked}`;
}
