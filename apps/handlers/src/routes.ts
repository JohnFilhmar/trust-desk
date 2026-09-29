import { get_account } from "#app/handlers/get_account.ts";
import { get_session } from "#app/handlers/get_session.ts";
import { health } from "#app/handlers/health.ts";
import { list_audit_logs } from "#app/handlers/list_audit_logs.ts";
import { login } from "#app/handlers/login.ts";
import { logout } from "#app/handlers/logout.ts";
import { search_accounts } from "#app/handlers/search_accounts.ts";
import { suspend_account } from "#app/handlers/suspend_account.ts";
import type { Route } from "#app/types/handler.ts";

/** Every endpoint this service answers. One line per handler file. */
export const routes: readonly Route[] = [
  { method: "GET", pattern: "/api/health", access: "public", handler: health },
  { method: "POST", pattern: "/api/login", access: "public", handler: login },
  { method: "POST", pattern: "/api/logout", access: "public", handler: logout },
  { method: "GET", pattern: "/api/session", access: "session", handler: get_session },
  {
    method: "GET",
    pattern: "/api/accounts",
    access: "accounts.read",
    handler: search_accounts,
  },
  {
    method: "GET",
    pattern: "/api/accounts/:account_id",
    access: "accounts.read",
    handler: get_account,
  },
  {
    method: "POST",
    pattern: "/api/accounts/:account_id/suspend",
    access: "accounts.enforce",
    handler: suspend_account,
  },
  {
    method: "GET",
    pattern: "/api/audit_logs",
    access: "audit.read",
    handler: list_audit_logs,
  },
];
