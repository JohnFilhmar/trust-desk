import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { create_core_api } from "#app/lib/core_api/client.ts";
import { sign_request } from "#app/lib/core_api/signing.ts";
import { test_correlation_id, test_now } from "#app/test_utils/fake_deps.ts";

const secret = "k".repeat(32);

function fixture(name: string): string {
  return readFileSync(
    join(__dirname, "../../../../../packages/shared/fixtures", name),
    "utf8",
  );
}

const body = {
  actor_staff_user_id: 3,
  reason: "Shared fingerprint cluster.",
  idempotency_key: null,
};

type Sent = { url: string; init: RequestInit };

function client_with(answer: () => Promise<Response>) {
  const sent: Sent[] = [];
  const fetch_fn: typeof fetch = async (input, init) => {
    sent.push({ url: String(input), init: init ?? {} });
    return answer();
  };
  const client = create_core_api({
    base_url: "http://core-api:3000",
    secret,
    clock: { now: () => test_now },
    fetch_fn,
  });
  return { client, sent };
}

function json(status: number, payload: string): () => Promise<Response> {
  return async () =>
    new Response(payload, { status, headers: { "content-type": "application/json" } });
}

function envelope(code: string): string {
  return JSON.stringify({
    error: { code, message: "Internal wording.", correlation_id: test_correlation_id },
  });
}

describe("the signed call to Rails", () => {
  it("signs exactly the bytes it sends", async () => {
    const { client, sent } = client_with(json(201, fixture("enforcement_result.json")));
    await client.enforce("suspend", 42, body, test_correlation_id);

    const request = sent[0];
    const headers = new Headers(request?.init.headers);
    const sent_body = String(request?.init.body);

    expect(request?.url).toBe("http://core-api:3000/internal/accounts/42/suspend");
    expect(sent_body).toBe(JSON.stringify(body));
    expect(headers.get("x-signature-timestamp")).toBe(
      String(Math.floor(test_now.getTime() / 1000)),
    );
    expect(headers.get("x-correlation-id")).toBe(test_correlation_id);
    expect(headers.get("x-signature")).toBe(
      sign_request(secret, {
        method: "POST",
        path: "/internal/accounts/42/suspend",
        timestamp: headers.get("x-signature-timestamp") ?? "",
        nonce: headers.get("x-signature-nonce") ?? "",
        body: sent_body,
      }),
    );
  });

  it("uses a new nonce for every call", async () => {
    const { client, sent } = client_with(json(201, fixture("enforcement_result.json")));
    await client.enforce("suspend", 42, body, test_correlation_id);
    await client.enforce("suspend", 42, body, test_correlation_id);

    const nonces = sent.map((item) => new Headers(item.init.headers).get("x-signature-nonce"));
    expect(nonces[0]).not.toBeNull();
    expect(nonces[0]).not.toBe(nonces[1]);
  });

  it.each([
    ["suspend", "/internal/accounts/42/suspend"],
    ["unsuspend", "/internal/accounts/42/unsuspend"],
    ["mark_spam", "/internal/accounts/42/mark_spam"],
  ] as const)("calls %s at %s", async (action, path) => {
    const { client, sent } = client_with(json(201, fixture("enforcement_result.json")));
    await client.enforce(action, 42, body, test_correlation_id);
    expect(sent[0]?.url).toBe(`http://core-api:3000${path}`);
  });

  it("records a reveal and reads back the id of the audit row", async () => {
    const { client, sent } = client_with(json(201, fixture("internal_reveal_result.json")));
    const outcome = await client.record_reveal(
      {
        actor_staff_user_id: 2,
        account_id: 42,
        reason: "Checking a reported phishing page.",
        fields: ["email", "signup_ip"],
      },
      test_correlation_id,
    );

    expect(sent[0]?.url).toBe("http://core-api:3000/internal/reveals");
    expect(outcome).toEqual({ kind: "ok", result: { audit_log_id: 7 } });
  });

  it("changes the mode and reads back the new row", async () => {
    const { client, sent } = client_with(
      json(201, fixture("internal_mode_change_result.json")),
    );
    const outcome = await client.change_mode(
      {
        actor_staff_user_id: 3,
        mode: "elevated",
        reason: "Signup burst from one network in the last hour.",
      },
      test_correlation_id,
    );

    expect(sent[0]?.url).toBe("http://core-api:3000/internal/operational_modes");
    expect(outcome.kind).toBe("ok");
  });

  it("accepts a 200, which is how Rails replays a stored answer", async () => {
    const { client } = client_with(json(200, fixture("enforcement_result.json")));
    const outcome = await client.enforce("suspend", 42, body, test_correlation_id);
    expect(outcome.kind).toBe("ok");
  });

  it("returns unavailable for a success that does not fit the contract", async () => {
    const { client } = client_with(json(201, '{"account":{"id":42}}'));
    const outcome = await client.enforce("suspend", 42, body, test_correlation_id);
    expect(outcome.kind).toBe("unavailable");
  });

  it("does not accept a reveal answer in place of an enforcement answer", async () => {
    const { client } = client_with(json(201, fixture("internal_reveal_result.json")));
    const outcome = await client.enforce("suspend", 42, body, test_correlation_id);
    expect(outcome.kind).toBe("unavailable");
  });

  it.each([
    [409, "already_suspended"],
    [409, "blocked_by_lockdown"],
    [404, "account_not_found"],
    [403, "forbidden"],
    [422, "idempotency_key_reused"],
  ])("returns rejected for a %i %s", async (status, code) => {
    const { client } = client_with(json(status, envelope(code)));
    const outcome = await client.enforce("suspend", 42, body, test_correlation_id);
    expect(outcome).toEqual({ kind: "rejected", status, code });
  });

  it.each([
    [401, envelope("invalid_signature")],
    [401, envelope("stale_timestamp")],
    [500, envelope("internal_error")],
    [502, "<html>Bad Gateway</html>"],
    [409, '{"unexpected":"shape"}'],
  ])("returns unavailable for a %i that is not the analyst's doing", async (status, payload) => {
    const { client } = client_with(json(status, payload));
    const outcome = await client.enforce("suspend", 42, body, test_correlation_id);
    expect(outcome.kind).toBe("unavailable");
  });

  it("returns unavailable when the network fails, and does not throw", async () => {
    const { client, sent } = client_with(async () => {
      throw new TypeError("fetch failed");
    });
    const outcome = await client.enforce("suspend", 42, body, test_correlation_id);

    expect(outcome.kind).toBe("unavailable");
    expect(sent).toHaveLength(1);
  });
});
