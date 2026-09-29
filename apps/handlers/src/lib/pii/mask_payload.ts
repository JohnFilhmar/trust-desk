import {
  mask_email,
  mask_fingerprint,
  mask_ip,
  mask_user_agent,
} from "#app/lib/pii/mask.ts";

const email_pattern = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const ipv4_pattern = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;

/** How deep a payload is followed. Anything deeper is dropped, not passed on unmasked. */
const max_depth = 6;

function mask_by_key(key: string, value: string): string | null {
  const name = key.toLowerCase();
  if (name === "ip" || name.endsWith("_ip")) return mask_ip(value);
  if (name === "email" || name.endsWith("_email")) return mask_email(value);
  if (name.includes("fingerprint")) return mask_fingerprint(value);
  if (name === "user_agent") return mask_user_agent(value);
  return null;
}

/**
 * Masks any email or IPv4 address found inside free text.
 *
 * @param text - Any string, such as the body of an abuse report.
 * @returns The text with each address replaced by its masked form.
 */
export function mask_text(text: string): string {
  return text
    .replace(email_pattern, (match) => mask_email(match))
    .replace(ipv4_pattern, (match) => mask_ip(match));
}

/** Masks one value of a payload. It follows objects and arrays, so PII nested at any level is reached. */
function mask_value(key: string, value: unknown, depth: number): unknown {
  if (typeof value === "string") return mask_by_key(key, value) ?? mask_text(value);
  if (value === null || typeof value !== "object") return value;
  if (depth >= max_depth) return "***";
  if (Array.isArray(value)) {
    return value.map((item: unknown) => mask_value(key, item, depth + 1));
  }
  return Object.fromEntries(
    Object.entries(value).map(([name, item]: [string, unknown]) => [
      name,
      mask_value(name, item, depth + 1),
    ]),
  );
}

/**
 * Masks an event payload before it leaves the service.
 *
 * A payload is free-form JSON, so PII can sit under any key. Two nets catch
 * it. Known keys, such as `ip` or anything ending in `_email`, are masked by
 * their own rule. Every other string is searched for emails and IPv4
 * addresses, which catches one pasted into a free-text field.
 *
 * @param payload - The event payload as stored.
 * @returns A copy with the same keys and every PII value masked.
 */
export function mask_payload(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, mask_value(key, value, 0)]),
  );
}
