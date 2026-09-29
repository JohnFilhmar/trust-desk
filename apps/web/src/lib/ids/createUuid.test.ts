import { afterEach, describe, expect, it } from "@jest/globals";
import { z } from "zod";
import { createUuid } from "@/lib/ids/createUuid";
import { removeRandomUuid, restoreRandomUuid } from "@/testUtils/insecureContext";

// Bug 002. A browser exposes `crypto.randomUUID` on HTTPS and on localhost
// only. On any other plain HTTP origin it is undefined, and every request
// failed with "crypto.randomUUID is not a function".

const versionAndVariant = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  restoreRandomUuid();
});

describe("createUuid", () => {
  it("runs in an environment that has the two crypto functions it relies on", () => {
    expect(typeof crypto.randomUUID).toBe("function");
    expect(typeof crypto.getRandomValues).toBe("function");
  });

  it("returns a version 4 UUID when crypto.randomUUID exists", () => {
    const uuid = createUuid();

    expect(z.uuid().safeParse(uuid).success).toBe(true);
    expect(uuid).toMatch(versionAndVariant);
  });

  it("returns a version 4 UUID when crypto.randomUUID does not exist", () => {
    removeRandomUuid();
    expect(crypto.randomUUID).toBeUndefined();

    const uuid = createUuid();

    expect(z.uuid().safeParse(uuid).success).toBe(true);
    expect(uuid).toMatch(versionAndVariant);
  });

  it("sets the version and the variant on every UUID it builds itself", () => {
    removeRandomUuid();

    for (const uuid of Array.from({ length: 200 }, createUuid)) {
      expect(uuid).toMatch(versionAndVariant);
    }
  });

  it("returns a different value on every call, on both paths", () => {
    expect(createUuid()).not.toBe(createUuid());

    removeRandomUuid();

    const uuids = Array.from({ length: 200 }, createUuid);
    expect(new Set(uuids).size).toBe(200);
  });
});
