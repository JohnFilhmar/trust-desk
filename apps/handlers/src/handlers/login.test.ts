import { describe, expect, it } from "@jest/globals";
import { error_envelope_schema, session_response_schema } from "@trust-desk/shared";
import { read_session_value } from "#app/lib/auth/session_cookie.ts";
import { dispatch } from "#app/router.ts";
import {
  console_request,
  fake_deps,
  staff_row,
  test_now,
  test_session_secret,
} from "#app/test_utils/fake_deps.ts";

const known_user = {
  find_staff_credentials_by_email: async (email: string) =>
    email === "enforcer@example.com"
      ? { ...staff_row("enforcer"), password_digest: "$2a$12$stored-hash" }
      : null,
};

function login_request(body: unknown): Request {
  return console_request("POST", "/api/login", { body });
}

describe("POST /api/login", () => {
  it("signs in and sets a cookie that reads back as that user", async () => {
    const res = await dispatch(
      login_request({ email: "enforcer@example.com", password: "correct" }),
      fake_deps(known_user),
    );

    expect(res.status).toBe(200);
    const body = session_response_schema.parse(await res.json());
    expect(body.user.group_name).toBe("enforcer");
    expect(body.user.permissions).toContain("accounts.enforce");

    const cookie = res.headers.getSetCookie()[0] ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Secure");

    const value = cookie.split(";")[0]?.split("=").slice(1).join("=") ?? "";
    expect(read_session_value(test_session_secret, value, test_now)?.staff_user_id).toBe(
      body.user.id,
    );
  });

  it("never returns the password hash", async () => {
    const res = await dispatch(
      login_request({ email: "enforcer@example.com", password: "correct" }),
      fake_deps(known_user),
    );
    expect(await res.text()).not.toContain("stored-hash");
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    const wrong_password = await dispatch(
      login_request({ email: "enforcer@example.com", password: "nope" }),
      fake_deps(known_user),
    );
    const unknown_email = await dispatch(
      login_request({ email: "nobody@example.com", password: "correct" }),
      fake_deps(known_user),
    );

    expect(wrong_password.status).toBe(401);
    expect(unknown_email.status).toBe(401);
    expect(wrong_password.headers.getSetCookie()).toEqual([]);

    const first = error_envelope_schema.parse(await wrong_password.json()).error;
    const second = error_envelope_schema.parse(await unknown_email.json()).error;
    expect(first.code).toBe("invalid_credentials");
    expect(second.code).toBe(first.code);
    expect(second.message).toBe(first.message);
  });

  it("checks the password even when no user matched", async () => {
    const seen: (string | null)[] = [];
    const deps = fake_deps(known_user);
    deps.auth = {
      verify_password: async (_password, digest) => {
        seen.push(digest);
        return false;
      },
    };
    await dispatch(
      login_request({ email: "nobody@example.com", password: "anything" }),
      deps,
    );
    expect(seen).toEqual([null]);
  });

  it.each([
    ["no body fields", {}],
    ["an email that is not one", { email: "not-an-email", password: "x" }],
    ["an empty password", { email: "enforcer@example.com", password: "" }],
  ])("answers 422 for %s", async (_name, body) => {
    const res = await dispatch(login_request(body), fake_deps(known_user));
    expect(res.status).toBe(422);
  });

  it("answers 422 for a body that is not JSON", async () => {
    const req = new Request("http://localhost/api/login", {
      method: "POST",
      headers: { origin: "http://localhost:5173" },
      body: "email=a&password=b",
    });
    const res = await dispatch(req, fake_deps(known_user));
    expect(res.status).toBe(422);
  });

  it("does not log the email or the password", async () => {
    const deps = fake_deps(known_user);
    await dispatch(
      login_request({ email: "enforcer@example.com", password: "nope" }),
      deps,
    );
    const logged = JSON.stringify([
      ...jest_calls(deps.logger.info),
      ...jest_calls(deps.logger.warn),
      ...jest_calls(deps.logger.error),
    ]);
    expect(logged).not.toContain("enforcer@example.com");
    expect(logged).not.toContain("nope");
  });
});

describe("POST /api/logout", () => {
  it("answers 204 and tells the browser to drop the cookie", async () => {
    const res = await dispatch(console_request("POST", "/api/logout"), fake_deps());
    expect(res.status).toBe(204);
    expect(res.headers.getSetCookie()[0]).toContain("Max-Age=0");
  });
});

function jest_calls(fn: unknown): unknown[] {
  if (typeof fn === "function" && "mock" in fn) {
    const mock: unknown = fn.mock;
    if (typeof mock === "object" && mock !== null && "calls" in mock) {
      return Array.isArray(mock.calls) ? mock.calls : [];
    }
  }
  return [];
}
