import { change_operational_mode } from "#app/handlers/change_operational_mode.ts";
import { get_account } from "#app/handlers/get_account.ts";
import { get_account_risk } from "#app/handlers/get_account_risk.ts";
import { get_operational_mode } from "#app/handlers/get_operational_mode.ts";
import { get_session } from "#app/handlers/get_session.ts";
import { health } from "#app/handlers/health.ts";
import { list_account_events } from "#app/handlers/list_account_events.ts";
import { list_audit_logs } from "#app/handlers/list_audit_logs.ts";
import { login } from "#app/handlers/login.ts";
import { logout } from "#app/handlers/logout.ts";
import { mark_account_spam } from "#app/handlers/mark_account_spam.ts";
import { reveal_account_pii } from "#app/handlers/reveal_account_pii.ts";
import { search_accounts } from "#app/handlers/search_accounts.ts";
import { suspend_account } from "#app/handlers/suspend_account.ts";
import { unsuspend_account } from "#app/handlers/unsuspend_account.ts";
import type { Route } from "#app/types/handler.ts";

const account = "/api/accounts/:account_id";

/** Every endpoint this service answers. One line per handler file. */
export const routes: readonly Route[] = [
  { method: "GET", pattern: "/api/health", access: "public", handler: health },
  { method: "POST", pattern: "/api/login", access: "public", handler: login },
  { method: "POST", pattern: "/api/logout", access: "public", handler: logout },
  { method: "GET", pattern: "/api/session", access: "session", handler: get_session },

  { method: "GET", pattern: "/api/accounts", access: "accounts.read", handler: search_accounts },
  { method: "GET", pattern: account, access: "accounts.read", handler: get_account },
  { method: "GET", pattern: `${account}/risk`, access: "accounts.read", handler: get_account_risk },
  { method: "GET", pattern: `${account}/events`, access: "accounts.read", handler: list_account_events },
  { method: "POST", pattern: `${account}/reveal`, access: "pii.reveal", handler: reveal_account_pii },

  { method: "POST", pattern: `${account}/suspend`, access: "accounts.enforce", handler: suspend_account },
  { method: "POST", pattern: `${account}/unsuspend`, access: "accounts.enforce", handler: unsuspend_account },
  { method: "POST", pattern: `${account}/mark_spam`, access: "accounts.enforce", handler: mark_account_spam },

  { method: "GET", pattern: "/api/audit_logs", access: "audit.read", handler: list_audit_logs },

  { method: "GET", pattern: "/api/operational_mode", access: "session", handler: get_operational_mode },
  { method: "POST", pattern: "/api/operational_mode", access: "mode.change", handler: change_operational_mode },
];
