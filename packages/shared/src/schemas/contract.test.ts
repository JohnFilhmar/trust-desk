import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { z } from "zod";
import { demo_accounts, demo_password } from "../lib/demo_accounts.ts";
import { demo_account_schema } from "./staff.ts";
import { enforcement_request_schema, enforcement_result_schema } from "./enforcement.ts";
import { account_search_query_schema } from "./account.ts";

function read_fixture(name: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, "../../fixtures", name), "utf8"));
}

describe("the contract with Rails", () => {
  it("accepts the enforcement result that the Rails tests also check", () => {
    const parsed = enforcement_result_schema.safeParse(
      read_fixture("enforcement_result.json"),
    );
    expect(parsed.success).toBe(true);
  });

  it("lists the same demo accounts as the fixture the Rails seed is tested against", () => {
    const fixture = z
      .object({ password: z.string(), accounts: z.array(demo_account_schema) })
      .parse(read_fixture("demo_accounts.json"));

    expect(fixture.password).toBe(demo_password);
    expect(fixture.accounts).toEqual(demo_accounts);
  });
});

describe("enforcement_request_schema", () => {
  it("refuses a reason shorter than 10 characters", () => {
    expect(enforcement_request_schema.safeParse({ reason: "spam" }).success).toBe(false);
  });

  it("refuses a reason that is only spaces", () => {
    expect(
      enforcement_request_schema.safeParse({ reason: " ".repeat(20) }).success,
    ).toBe(false);
  });

  it("trims the reason it accepts", () => {
    const parsed = enforcement_request_schema.parse({
      reason: "  Shared fingerprint cluster.  ",
    });
    expect(parsed.reason).toBe("Shared fingerprint cluster.");
  });
});

describe("account_search_query_schema", () => {
  it("defaults the limit to 25 and reads it from text", () => {
    expect(account_search_query_schema.parse({}).limit).toBe(25);
    expect(account_search_query_schema.parse({ limit: "10" }).limit).toBe(10);
  });

  it("refuses a limit above 100 and an unknown status", () => {
    expect(account_search_query_schema.safeParse({ limit: "101" }).success).toBe(false);
    expect(account_search_query_schema.safeParse({ status: "banned" }).success).toBe(
      false,
    );
  });
});
