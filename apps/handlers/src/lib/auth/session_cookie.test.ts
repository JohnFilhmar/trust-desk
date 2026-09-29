import { describe, expect, it } from "@jest/globals";
import {
  build_set_cookie,
  issue_session_value,
  read_cookie,
  read_session_value,
  session_lifetime_seconds,
} from "#app/lib/auth/session_cookie.ts";

const secret = "s".repeat(32);
const now = new Date("2026-09-30T00:00:00.000Z");

function later(seconds: number): Date {
  return new Date(now.getTime() + seconds * 1000);
}

describe("session cookie", () => {
  it("reads back what it issued", () => {
    const value = issue_session_value(secret, 3, now);
    expect(read_session_value(secret, value, now)?.staff_user_id).toBe(3);
  });

  it("rejects a payload that was changed after signing", () => {
    const [, signature] = issue_session_value(secret, 3, now).split(".");
    const forged_payload = Buffer.from(
      JSON.stringify({
        staff_user_id: 1,
        issued_at: 1,
        expires_at: 9_999_999_999,
      }),
    ).toString("base64url");
    expect(read_session_value(secret, `${forged_payload}.${signature}`, now)).toBeNull();
  });

  it("rejects a value signed with another secret", () => {
    const value = issue_session_value("o".repeat(32), 3, now);
    expect(read_session_value(secret, value, now)).toBeNull();
  });

  it("is valid one second before it expires and invalid at the moment it does", () => {
    const value = issue_session_value(secret, 3, now);
    expect(read_session_value(secret, value, later(session_lifetime_seconds - 1))).not.toBeNull();
    expect(read_session_value(secret, value, later(session_lifetime_seconds))).toBeNull();
  });

  it.each(["", "abc", "a.b.c", ".", "e30.", "not-base64.deadbeef"])(
    "rejects the malformed value %p without throwing",
    (value) => {
      expect(read_session_value(secret, value, now)).toBeNull();
    },
  );
});

describe("read_cookie", () => {
  it("finds a cookie among others", () => {
    expect(read_cookie("a=1; td_session=xyz; b=2", "td_session")).toBe("xyz");
  });

  it("does not match a cookie whose name only ends with the wanted name", () => {
    expect(read_cookie("not_td_session=evil", "td_session")).toBeNull();
  });

  it("returns null with no header", () => {
    expect(read_cookie(null, "td_session")).toBeNull();
  });
});

describe("build_set_cookie", () => {
  it("is unreadable by scripts and never sent by another site", () => {
    const cookie = build_set_cookie("value", true);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Path=/");
  });

  it("leaves Secure out over plain http, where a browser would drop the cookie", () => {
    expect(build_set_cookie("value", false)).not.toContain("Secure");
  });

  it("ends the session with an empty value and a zero lifetime", () => {
    const cookie = build_set_cookie("", true);
    expect(cookie).toContain("td_session=;");
    expect(cookie).toContain("Max-Age=0");
  });
});
