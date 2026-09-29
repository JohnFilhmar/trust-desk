import { createHash, createHmac } from "node:crypto";

/** The five values a signature covers. */
export type SignableRequest = {
  /** Uppercase, such as `POST`. */
  method: string;
  /** The path with its query string, such as `/internal/accounts?status=active`. */
  path: string;
  /** Unix seconds, as text. */
  timestamp: string;
  /** A value used once. A replay carries one Rails has already seen. */
  nonce: string;
  /** The exact bytes sent. An empty string when there is no body. */
  body: string;
};

/**
 * Builds the string that gets signed.
 *
 * @param request - The five parts of the request.
 * @returns The parts joined by a newline, with the body replaced by its
 *   SHA-256. The separator matters: without one, `/a1` followed by `23` and
 *   `/a` followed by `123` would produce the same string.
 */
export function build_canonical_request(request: SignableRequest): string {
  const body_sha256 = createHash("sha256").update(request.body, "utf8").digest("hex");
  return [
    request.method,
    request.path,
    request.timestamp,
    request.nonce,
    body_sha256,
  ].join("\n");
}

/**
 * Signs a request for Rails.
 *
 * @param secret - The secret both services hold.
 * @param request - The five parts of the request.
 * @returns HMAC-SHA256 of the canonical string, as lowercase hex.
 */
export function sign_request(secret: string, request: SignableRequest): string {
  return createHmac("sha256", secret)
    .update(build_canonical_request(request), "utf8")
    .digest("hex");
}
