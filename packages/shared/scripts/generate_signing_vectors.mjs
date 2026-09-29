// Writes fixtures/signing_vectors.json.
//
// This script is the reference for the signing scheme. It uses nothing but
// Node's crypto module and shares no code with the handlers or with Rails.
// Both implementations are tested against the file it writes.
//
// Run from the repository root, inside the Node container:
//   node packages/shared/scripts/generate_signing_vectors.mjs

import { createHash, createHmac } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const secret = "dev-only-vector-not-a-secret-0123456789abcdef";

const cases = [
  {
    name: "POST with a JSON body",
    method: "POST",
    path: "/internal/accounts/42/suspend",
    timestamp: "1790726400",
    nonce: "5f0c1b9e-2a3d-4c6f-8e7a-9b0c1d2e3f40",
    body: '{"actor_staff_user_id":3,"reason":"Twelve accounts share this fingerprint."}',
  },
  {
    name: "POST with an empty body",
    method: "POST",
    path: "/internal/ping",
    timestamp: "1790726401",
    nonce: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
    body: "",
  },
  {
    name: "GET with a query string, which is part of the path",
    method: "GET",
    path: "/internal/accounts?status=suspended&limit=10",
    timestamp: "1790726402",
    nonce: "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a",
    body: "",
  },
  {
    name: "POST with characters outside ASCII, hashed as UTF-8 bytes",
    method: "POST",
    path: "/internal/accounts/7/suspend",
    timestamp: "1790726403",
    nonce: "11111111-2222-4333-8444-555555555555",
    body: '{"actor_staff_user_id":3,"reason":"Phishing page for Banco Núñez, reported 14×."}',
  },
];

const vectors = cases.map((item) => {
  const body_sha256 = createHash("sha256").update(item.body, "utf8").digest("hex");
  const canonical = [
    item.method,
    item.path,
    item.timestamp,
    item.nonce,
    body_sha256,
  ].join("\n");
  const signature = createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
  return { ...item, body_sha256, canonical, signature };
});

const output = {
  description:
    "Known inputs and their expected signatures. Written by scripts/generate_signing_vectors.mjs. Do not edit by hand.",
  scheme: {
    canonical: "method, path with query string, timestamp, nonce and sha256 of the body, joined by a newline",
    algorithm: "HMAC-SHA256, lowercase hex",
    headers: ["X-Signature", "X-Signature-Timestamp", "X-Signature-Nonce"],
    timestamp: "Unix seconds",
    window_seconds: 60,
  },
  secret,
  vectors,
};

const target = fileURLToPath(new URL("../fixtures/signing_vectors.json", import.meta.url));
writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${vectors.length} vectors to ${target}`);
for (const vector of vectors) console.log(vector.signature, vector.name);
