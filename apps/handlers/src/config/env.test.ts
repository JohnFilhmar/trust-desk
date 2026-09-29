import { describe, expect, it } from "@jest/globals";
import { load_env } from "#app/config/env.ts";

const valid = {
  NODE_ENV: "test",
  HANDLERS_PORT: "8787",
  APP_ORIGIN: "http://localhost:5173",
  DB_HOST: "mysql",
  DB_NAME: "trust_desk_test",
  DB_HANDLERS_USERNAME: "td_handlers",
  DB_HANDLERS_PASSWORD: "not-a-real-password",
  CORE_API_URL: "http://core-api:3000",
  SERVICE_HMAC_SECRET: "x".repeat(32),
  SESSION_SECRET: "y".repeat(32),
};

describe("load_env", () => {
  it("turns the port into a number and fills the defaults", () => {
    const env = load_env(valid);
    expect(env.HANDLERS_PORT).toBe(8787);
    expect(env.DB_PORT).toBe(3306);
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("names the missing variable and never prints a value", () => {
    const { SERVICE_HMAC_SECRET: _removed, ...missing } = valid;
    expect(() => load_env(missing)).toThrow(/SERVICE_HMAC_SECRET/);
    expect(() => load_env(missing)).not.toThrow(/not-a-real-password/);
  });

  it("rejects a signing secret shorter than 32 characters", () => {
    expect(() => load_env({ ...valid, SERVICE_HMAC_SECRET: "short" })).toThrow(
      /SERVICE_HMAC_SECRET/,
    );
  });
});
