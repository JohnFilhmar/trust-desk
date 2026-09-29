import type { IncomingMessage, ServerResponse } from "node:http";
import {
  client_ip_header,
  real_ip_header,
  resolve_client_ip,
} from "#app/lib/http/client_ip.ts";

/** Larger request bodies are refused before they are read into memory. */
const max_body_bytes = 1_048_576;

/** Thrown when a request body is larger than `max_body_bytes`. */
export class BodyTooLargeError extends Error {}

async function read_body(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer: Buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > max_body_bytes) throw new BodyTooLargeError();
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

/**
 * Turns a Node request into a web-standard Request. On AWS Lambda this
 * function is the only part that would be replaced.
 *
 * @param req - The request Node's HTTP server received.
 * @returns A Request with the same method, URL, headers and body.
 * @throws {BodyTooLargeError} When the body exceeds one megabyte.
 */
export async function to_web_request(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? "localhost";
  const url = new URL(req.url ?? "/", `http://${host}`);

  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      headers.append(name, item);
    }
  }

  // Set last, so it replaces a header of the same name sent by the caller.
  // Handlers read the client IP from here and from nowhere else.
  headers.set(
    client_ip_header,
    resolve_client_ip(req.socket.remoteAddress, headers.get(real_ip_header)),
  );

  const method = req.method ?? "GET";
  const has_body = method !== "GET" && method !== "HEAD";
  const body = has_body ? await read_body(req) : undefined;

  return new Request(url, {
    method,
    headers,
    ...(body !== undefined && body.length > 0 ? { body } : {}),
  });
}

/**
 * Writes a web-standard Response to a Node response.
 *
 * @param response - What the handler returned.
 * @param res - Node's response object.
 */
export async function send_web_response(
  response: Response,
  res: ServerResponse,
): Promise<void> {
  res.statusCode = response.status;
  // A Headers object joins repeated headers with a comma, which breaks
  // Set-Cookie. getSetCookie returns each cookie separately.
  const cookies = response.headers.getSetCookie();
  for (const [name, value] of response.headers) {
    if (name !== "set-cookie") res.setHeader(name, value);
  }
  if (cookies.length > 0) res.setHeader("set-cookie", cookies);
  res.end(Buffer.from(await response.arrayBuffer()));
}
