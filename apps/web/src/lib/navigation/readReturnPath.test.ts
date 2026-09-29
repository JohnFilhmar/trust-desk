import { describe, expect, it } from "@jest/globals";
import { defaultReturnPath, readReturnPath } from "@/lib/navigation/readReturnPath";

describe("readReturnPath", () => {
  it.each([
    "/accounts",
    "/accounts/42",
    "/audit",
    "/accounts?status=suspended",
    "/accounts?fingerprint=9f2c4e6a8b0d1f3e5a7c9e1b3d5f7a90&status=active",
    "/accounts?email=ring-01%40example.com",
  ])("keeps %s, a page of this console", (returnPath) => {
    expect(readReturnPath({ returnPath })).toBe(returnPath);
  });

  // Each of these leaves the site, or could be made to, once a browser or a
  // router has normalized it. A backslash is the one the first version of
  // this check let through: browsers read "/\" as "//".
  it.each([
    ["a protocol-relative address", "//evil.example.org"],
    ["a backslash after the slash", "/\\evil.example.org"],
    ["a backslash further in", "/accounts\\..\\..\\evil.example.org"],
    ["an encoded backslash", "/%5Cevil.example.org"],
    ["an encoded slash", "/%2Fevil.example.org"],
    ["a full address", "https://evil.example.org/accounts"],
    ["a script address", "javascript:alert(1)"],
    ["a path with no leading slash", "accounts"],
    ["a tab inside the path", "/\taccounts"],
    ["a line break inside the path", "/accounts\n//evil.example.org"],
    ["a path that climbs out", "/accounts/../../evil"],
    ["a page this console does not have", "/admin"],
    ["the login page itself, which would loop", "/login"],
    ["a fragment that carries an address", "/accounts#//evil.example.org"],
    ["an empty path", ""],
  ])("refuses %s", (_name, returnPath) => {
    expect(readReturnPath({ returnPath })).toBe(defaultReturnPath);
  });

  it.each([
    ["no state", null],
    ["state of another shape", { from: "/accounts" }],
    ["a path that is not text", { returnPath: 42 }],
    ["a path that is a list", { returnPath: ["/accounts"] }],
    ["text in place of an object", "/accounts"],
  ])("falls back to the accounts page for %s", (_name, state) => {
    expect(readReturnPath(state)).toBe(defaultReturnPath);
  });
});
