import { createServer } from "node:http";
import { pino } from "pino";
import { load_env } from "#app/config/env.ts";
import type { Clock, Deps } from "#app/interfaces/deps.ts";
import { create_auth } from "#app/lib/auth/password.ts";
import { create_core_api } from "#app/lib/core_api/client.ts";
import { create_pool } from "#app/lib/db/pool.ts";
import { resolve_correlation_id } from "#app/lib/http/correlation_id.ts";
import { error_response } from "#app/lib/http/json_response.ts";
import {
  BodyTooLargeError,
  send_web_response,
  to_web_request,
} from "#app/lib/http/node_adapter.ts";
import { create_database } from "#app/repositories/database.ts";
import { dispatch } from "#app/router.ts";

const env = load_env(process.env);
const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "handlers" },
  // A second guard. No code should log these, and if some code does, the
  // value is replaced before the line is written.
  redact: {
    paths: [
      "password",
      "password_digest",
      "cookie",
      "signature",
      "*.password",
      "*.password_digest",
      "req.headers.cookie",
      'req.headers["x-signature"]',
    ],
    censor: "[redacted]",
  },
});
const pool = create_pool(env);
const clock: Clock = { now: () => new Date() };

const deps: Deps = {
  db: create_database(pool),
  auth: await create_auth(),
  core_api: create_core_api({
    base_url: env.CORE_API_URL,
    secret: env.SERVICE_HMAC_SECRET,
    clock,
  }),
  clock,
  logger,
  config: {
    session_secret: env.SESSION_SECRET,
    allowed_origins: env.APP_ORIGINS,
    secure_cookies: env.APP_ORIGINS.every((origin) => origin.startsWith("https://")),
  },
};

const server = createServer((req, res) => {
  const started = process.hrtime.bigint();

  to_web_request(req)
    .then((request) => dispatch(request, deps))
    .catch((error: unknown) => {
      const header = req.headers["x-correlation-id"];
      const correlation_id = resolve_correlation_id(
        typeof header === "string" ? header : null,
      );
      if (error instanceof BodyTooLargeError) {
        return error_response(
          413,
          "body_too_large",
          "The request body is too large.",
          correlation_id,
        );
      }
      logger.error({ correlation_id, err: error }, "Request could not be read.");
      return error_response(
        400,
        "bad_request",
        "The request could not be read.",
        correlation_id,
      );
    })
    .then(async (response) => {
      await send_web_response(response, res);
      logger.info(
        {
          correlation_id: response.headers.get("x-correlation-id"),
          method: req.method,
          // The path only. A query string can carry an email or an IP.
          path: (req.url ?? "/").split("?")[0],
          status: response.status,
          duration_ms: Number((process.hrtime.bigint() - started) / 1_000_000n),
        },
        "Request served.",
      );
    })
    .catch((error: unknown) => {
      logger.error({ err: error }, "Response could not be sent.");
      res.destroy();
    });
});

// 0.0.0.0 listens on every interface inside the container. 127.0.0.1 would
// make the service unreachable through Docker's port mapping.
server.listen(env.HANDLERS_PORT, "0.0.0.0", () => {
  logger.info({ port: env.HANDLERS_PORT }, "Handlers listening.");
});

function shut_down(signal: string): void {
  logger.info({ signal }, "Shutting down.");
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
}

process.on("SIGTERM", () => shut_down("SIGTERM"));
process.on("SIGINT", () => shut_down("SIGINT"));
