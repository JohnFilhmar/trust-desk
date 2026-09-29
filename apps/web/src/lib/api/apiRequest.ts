import { error_envelope_schema } from "@trust-desk/shared";
import type { z } from "zod";
import { ApiError } from "@/lib/api/apiError";

/** The part of a fetch response that `apiRequest` reads. */
export type ApiResponse = Pick<Response, "ok" | "status" | "json">;

/** The part of `fetch` that `apiRequest` calls. A test passes its own. */
export type FetchFunction = (path: string, init: RequestInit) => Promise<ApiResponse>;

/** What one call to the API needs. */
export type ApiRequestOptions<TSchema extends z.ZodType> = {
  method: "GET" | "POST";
  /** A path on the same origin, such as `/api/accounts`. */
  path: string;
  /** The schema of the success body. Use `z.void()` for a 204. */
  schema: TSchema;
  /** Query string values. An entry that is `undefined` is left out. */
  query?: Record<string, string | number | undefined>;
  /** Sent as JSON. When absent, the request has no body and no content type. */
  body?: unknown;
  /** Replaces the browser's `fetch`. Only tests set it. */
  fetchFunction?: FetchFunction;
};

/**
 * Sends one request to the API and returns the success body, parsed.
 *
 * @param options - The request. Every call gets a fresh correlation id.
 * @returns The success body as the schema describes it.
 * @throws {ApiError} With the envelope's code on a refusal, with `unexpected_response` when a body does not fit its schema, and with `network_error` when no response arrives.
 */
export async function apiRequest<TSchema extends z.ZodType>(
  options: ApiRequestOptions<TSchema>,
): Promise<z.infer<TSchema>> {
  const correlationId = crypto.randomUUID();
  const send = options.fetchFunction ?? browserFetch;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Correlation-Id": correlationId,
  };
  const init: RequestInit = {
    method: options.method,
    credentials: "same-origin",
    headers,
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  let response: ApiResponse;
  try {
    response = await send(buildPath(options.path, options.query), init);
  } catch {
    throw new ApiError({
      status: 0,
      code: "network_error",
      message: "The server could not be reached. Check your connection and try again.",
      correlationId,
    });
  }

  const body = await readBody(response);

  if (!response.ok) {
    const envelope = error_envelope_schema.safeParse(body);
    if (!envelope.success) {
      throw unexpectedResponse(response.status, correlationId);
    }
    throw new ApiError({
      status: response.status,
      code: envelope.data.error.code,
      message: envelope.data.error.message,
      correlationId: envelope.data.error.correlation_id,
    });
  }

  const parsed = options.schema.safeParse(body);
  if (!parsed.success) {
    throw unexpectedResponse(response.status, correlationId);
  }
  return parsed.data;
}

function browserFetch(path: string, init: RequestInit): Promise<ApiResponse> {
  return fetch(path, init);
}

function buildPath(path: string, query: ApiRequestOptions<z.ZodType>["query"]): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      params.set(name, String(value));
    }
  }
  const queryString = params.toString();
  return queryString === "" ? path : `${path}?${queryString}`;
}

async function readBody(response: ApiResponse): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }
  try {
    const body: unknown = await response.json();
    return body;
  } catch {
    return undefined;
  }
}

function unexpectedResponse(status: number, correlationId: string): ApiError {
  return new ApiError({
    status,
    code: "unexpected_response",
    message: "The server sent a response this app could not read.",
    correlationId,
  });
}
