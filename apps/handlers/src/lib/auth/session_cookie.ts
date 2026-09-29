import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const session_cookie_name = "td_session";

/** How long a session lasts. A stolen cookie is valid for at most this long. */
export const session_lifetime_seconds = 8 * 60 * 60;

const payload_schema = z.object({
  staff_user_id: z.number().int().positive(),
  issued_at: z.number().int().positive(),
  expires_at: z.number().int().positive(),
});

export type SessionPayload = z.infer<typeof payload_schema>;

function sign(secret: string, encoded_payload: string): string {
  return createHmac("sha256", secret).update(encoded_payload, "utf8").digest("hex");
}

/**
 * Creates the value of the session cookie.
 *
 * @param secret - The session secret. Never the secret shared with Rails.
 * @param staff_user_id - Who signed in.
 * @param now - The current moment.
 * @returns The payload as base64url, a dot, and the signature of the payload.
 *   The payload is readable by anyone. The signature is what stops someone
 *   from changing it.
 */
export function issue_session_value(
  secret: string,
  staff_user_id: number,
  now: Date,
): string {
  const issued_at = Math.floor(now.getTime() / 1000);
  const payload: SessionPayload = {
    staff_user_id,
    issued_at,
    expires_at: issued_at + session_lifetime_seconds,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(secret, encoded)}`;
}

/** Checks a cookie value and reads it. Every failure gives the same answer, `null`. */
export function read_session_value(
  secret: string,
  value: string,
  now: Date,
): SessionPayload | null {
  const [encoded, signature, ...rest] = value.split(".");
  if (encoded === undefined || signature === undefined || rest.length > 0) return null;

  const expected = Buffer.from(sign(secret, encoded), "utf8");
  const given = Buffer.from(signature, "utf8");
  // timingSafeEqual throws on a length mismatch, so the length is checked
  // first. The signature is checked before the payload is parsed, so nothing
  // unsigned ever reaches JSON.parse.
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const parsed = payload_schema.safeParse(decoded);
  if (!parsed.success) return null;
  if (parsed.data.expires_at <= Math.floor(now.getTime() / 1000)) return null;
  return parsed.data;
}

/**
 * Finds one cookie in a `Cookie` request header.
 *
 * @param header - The header value, or `null` when the request has none.
 * @param name - The cookie to find.
 * @returns The cookie's value, or `null` when it is absent.
 */
export function read_cookie(header: string | null, name: string): string | null {
  if (header === null) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

/**
 * Builds the `Set-Cookie` header that starts or ends a session.
 *
 * @param value - The signed value, or an empty string to end the session.
 * @param secure - Whether to add `Secure`. True whenever the site is served over https.
 * @returns A cookie that scripts cannot read and other sites cannot send.
 */
export function build_set_cookie(value: string, secure: boolean): string {
  const max_age = value === "" ? 0 : session_lifetime_seconds;
  const attributes = [
    `${session_cookie_name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${max_age}`,
  ];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}
