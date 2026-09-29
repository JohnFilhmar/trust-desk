import { session_response_schema } from "@trust-desk/shared";
import type { LoginRequest, SessionResponse } from "@trust-desk/shared";
import { z } from "zod";
import { apiRequest } from "@/lib/api/apiRequest";

/**
 * Signs a staff user in. The server answers with a session cookie.
 *
 * @param credentials - Sent as typed. The server validates them.
 * @returns The signed-in user.
 * @throws {ApiError} With `invalid_credentials`, `invalid_request` or `rate_limited`.
 */
export function login(credentials: LoginRequest): Promise<SessionResponse> {
  return apiRequest({
    method: "POST",
    path: "/api/login",
    schema: session_response_schema,
    body: credentials,
  });
}

/**
 * Signs the staff user out. The server clears the session cookie.
 *
 * @throws {ApiError} When the request fails.
 */
export function logout(): Promise<void> {
  return apiRequest({ method: "POST", path: "/api/logout", schema: z.void() });
}

/**
 * Reads who is signed in.
 *
 * @returns The signed-in user.
 * @throws {ApiError} With status 401 and `unauthenticated` when nobody is signed in.
 */
export function fetchSession(): Promise<SessionResponse> {
  return apiRequest({ method: "GET", path: "/api/session", schema: session_response_schema });
}
