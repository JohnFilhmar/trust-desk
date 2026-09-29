import { describe, expect, it, jest } from "@jest/globals";
import { session_response_schema } from "@trust-desk/shared";
import { z } from "zod";
import { ApiError } from "@/lib/api/apiError";
import { apiRequest } from "@/lib/api/apiRequest";
import type { ApiResponse, FetchFunction } from "@/lib/api/apiRequest";
import { buildSession, correlationId, uuidPattern } from "@/testUtils/fixtures";
import { removeRandomUuid, restoreRandomUuid } from "@/testUtils/insecureContext";

function headersHolding(values: Record<string, string>): ApiResponse["headers"] {
  return { get: (name) => values[name] ?? null };
}

function respondWith(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): ApiResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    headers: headersHolding(headers),
  };
}

function envelope(code: string, message: string): unknown {
  return { error: { code, message, correlation_id: correlationId } };
}

function fetchAnswering(response: ApiResponse): jest.Mock<FetchFunction> {
  return jest.fn<FetchFunction>().mockResolvedValue(response);
}

function readHeader(init: RequestInit | undefined, name: string): unknown {
  const headers: unknown = init?.headers;
  if (typeof headers !== "object" || headers === null) {
    return undefined;
  }
  return Object.entries(headers).find(([key]) => key === name)?.[1];
}

async function catchError(request: Promise<unknown>): Promise<unknown> {
  try {
    await request;
  } catch (error) {
    return error;
  }
  throw new Error("The request was expected to fail, and it succeeded.");
}

describe("apiRequest", () => {
  it("parses a success body with the schema it is given", async () => {
    const session = buildSession("analyst");
    const fetchFunction = fetchAnswering(respondWith(200, session));

    const result = await apiRequest({
      method: "GET",
      path: "/api/session",
      schema: session_response_schema,
      fetchFunction,
    });

    expect(result).toEqual(session);
  });

  it("sends same-origin credentials and a fresh correlation id on every request", async () => {
    const fetchFunction = fetchAnswering(respondWith(200, buildSession("viewer")));

    for (const _attempt of [1, 2]) {
      await apiRequest({
        method: "GET",
        path: "/api/session",
        schema: session_response_schema,
        fetchFunction,
      });
    }

    expect(fetchFunction).toHaveBeenCalledTimes(2);
    const [firstCall, secondCall] = fetchFunction.mock.calls;
    expect(firstCall?.[0]).toBe("/api/session");
    expect(firstCall?.[1].credentials).toBe("same-origin");
    expect(readHeader(firstCall?.[1], "Content-Type")).toBeUndefined();
    const firstId = readHeader(firstCall?.[1], "X-Correlation-Id");
    const secondId = readHeader(secondCall?.[1], "X-Correlation-Id");
    expect(firstId).toMatch(uuidPattern);
    expect(secondId).toMatch(uuidPattern);
    expect(firstId).not.toBe(secondId);
  });

  it("sends a body as JSON and leaves undefined values out of the query string", async () => {
    const fetchFunction = fetchAnswering(respondWith(200, buildSession("viewer")));

    await apiRequest({
      method: "POST",
      path: "/api/login",
      schema: session_response_schema,
      query: { status: "active", cursor: undefined, limit: 25 },
      body: { email: "viewer@example.com", password: "secret" },
      fetchFunction,
    });

    const [path, init] = fetchFunction.mock.calls[0] ?? [];
    expect(path).toBe("/api/login?status=active&limit=25");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe('{"email":"viewer@example.com","password":"secret"}');
    expect(readHeader(init, "Content-Type")).toBe("application/json");
  });

  it("returns nothing for a 204 and does not read a body", async () => {
    const json = jest.fn<ApiResponse["json"]>();
    const fetchFunction = fetchAnswering({
      ok: true,
      status: 204,
      json,
      headers: headersHolding({}),
    });

    const result = await apiRequest({
      method: "POST",
      path: "/api/logout",
      schema: z.void(),
      fetchFunction,
    });

    expect(result).toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });

  it("throws an ApiError with the envelope's code on a 4xx", async () => {
    const fetchFunction = fetchAnswering(
      respondWith(409, envelope("already_suspended", "The account is already suspended.")),
    );

    const error = await catchError(
      apiRequest({
        method: "POST",
        path: "/api/accounts/42/suspend",
        schema: session_response_schema,
        body: { reason: "Twelve accounts share this fingerprint." },
        fetchFunction,
      }),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "already_suspended",
      message: "The account is already suspended.",
      correlationId,
      retryAfterSeconds: null,
    });
  });

  it("carries the Retry-After header of a 429 as whole seconds", async () => {
    const fetchFunction = fetchAnswering(
      respondWith(429, envelope("rate_limited", "Too many attempts."), { "Retry-After": "120" }),
    );

    const error = await catchError(
      apiRequest({
        method: "POST",
        path: "/api/login",
        schema: session_response_schema,
        body: { email: "viewer@example.com", password: "secret" },
        fetchFunction,
      }),
    );

    expect(error).toMatchObject({ status: 429, code: "rate_limited", retryAfterSeconds: 120 });
  });

  it("ignores a Retry-After header that is not a number of seconds", async () => {
    const fetchFunction = fetchAnswering(
      respondWith(429, envelope("rate_limited", "Too many attempts."), {
        "Retry-After": "Wed, 30 Sep 2026 07:28:00 GMT",
      }),
    );

    const error = await catchError(
      apiRequest({
        method: "POST",
        path: "/api/login",
        schema: session_response_schema,
        body: { email: "viewer@example.com", password: "secret" },
        fetchFunction,
      }),
    );

    expect(error).toMatchObject({ status: 429, retryAfterSeconds: null });
  });

  it("sends extra headers, and never lets one replace the correlation id", async () => {
    const fetchFunction = fetchAnswering(respondWith(200, buildSession("viewer")));

    await apiRequest({
      method: "POST",
      path: "/api/accounts/42/suspend",
      schema: session_response_schema,
      body: { reason: "Twelve accounts share this fingerprint." },
      headers: { "Idempotency-Key": correlationId, "X-Correlation-Id": "not-a-uuid" },
      fetchFunction,
    });

    const [, init] = fetchFunction.mock.calls[0] ?? [];
    expect(readHeader(init, "Idempotency-Key")).toBe(correlationId);
    expect(readHeader(init, "X-Correlation-Id")).toMatch(uuidPattern);
  });

  it("throws unexpected_response when the error body is not an envelope", async () => {
    const fetchFunction = fetchAnswering(respondWith(502, { detail: "Bad gateway" }));

    const error = await catchError(
      apiRequest({
        method: "GET",
        path: "/api/session",
        schema: session_response_schema,
        fetchFunction,
      }),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: "unexpected_response" });
  });

  it("throws unexpected_response when the error body is not JSON", async () => {
    const fetchFunction = fetchAnswering({
      ok: false,
      status: 500,
      json: () => Promise.reject(new SyntaxError("Unexpected token <")),
      headers: headersHolding({}),
    });

    const error = await catchError(
      apiRequest({
        method: "GET",
        path: "/api/session",
        schema: session_response_schema,
        fetchFunction,
      }),
    );

    expect(error).toMatchObject({ status: 500, code: "unexpected_response" });
  });

  it("throws when a success body does not fit the schema", async () => {
    const fetchFunction = fetchAnswering(respondWith(200, { user: { id: "not a number" } }));

    const error = await catchError(
      apiRequest({
        method: "GET",
        path: "/api/session",
        schema: session_response_schema,
        fetchFunction,
      }),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 200, code: "unexpected_response" });
  });

  // Bug 002. On a plain HTTP origin other than localhost the browser has no
  // `crypto.randomUUID`, and every request failed before it was sent.
  it("still sends a request with a valid correlation id without crypto.randomUUID", async () => {
    const session = buildSession("viewer");
    const fetchFunction = fetchAnswering(respondWith(200, session));
    removeRandomUuid();

    let result: unknown;
    try {
      result = await apiRequest({
        method: "GET",
        path: "/api/session",
        schema: session_response_schema,
        fetchFunction,
      });
    } finally {
      restoreRandomUuid();
    }

    expect(result).toEqual(session);
    expect(fetchFunction).toHaveBeenCalledTimes(1);
    const [, init] = fetchFunction.mock.calls[0] ?? [];
    const sentId = readHeader(init, "X-Correlation-Id");
    expect(z.uuid().safeParse(sentId).success).toBe(true);
  });

  it("throws network_error with the id it sent when no response arrives", async () => {
    const fetchFunction = jest
      .fn<FetchFunction>()
      .mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await catchError(
      apiRequest({
        method: "GET",
        path: "/api/session",
        schema: session_response_schema,
        fetchFunction,
      }),
    );

    expect(error).toMatchObject({ status: 0, code: "network_error" });
    const [, init] = fetchFunction.mock.calls[0] ?? [];
    expect(readHeader(init, "X-Correlation-Id")).toMatch(uuidPattern);
    expect(error).toMatchObject({ correlationId: readHeader(init, "X-Correlation-Id") });
  });
});
