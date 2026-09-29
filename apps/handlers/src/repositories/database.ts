import type { Pool } from "mysql2/promise";
import type { Database } from "#app/interfaces/deps.ts";
import { find_account_by_id, search_accounts } from "#app/repositories/queries/accounts.ts";
import { list_audit_logs } from "#app/repositories/queries/audit_logs.ts";
import { list_enforcement_actions } from "#app/repositories/queries/enforcement_actions.ts";
import { list_events } from "#app/repositories/queries/events.ts";
import { find_current_mode } from "#app/repositories/queries/operational_modes.ts";
import {
  count_accounts_sharing_fingerprint,
  count_events_for_days,
  count_signups_from_same_ip,
  list_event_days,
  list_quick_risk,
  list_stats_days,
} from "#app/repositories/queries/risk.ts";
import {
  find_staff_credentials_by_email,
  find_staff_user_by_id,
} from "#app/repositories/queries/staff_users.ts";

/**
 * Builds the read-side queries on top of a pool.
 *
 * @param pool - The connection pool of the handlers' database user.
 * @returns The named queries that handlers receive through `deps.db`.
 */
export function create_database(pool: Pool): Database {
  return {
    async ping(): Promise<boolean> {
      try {
        await pool.query("SELECT 1");
        return true;
      } catch {
        return false;
      }
    },
    find_staff_credentials_by_email: (email) =>
      find_staff_credentials_by_email(pool, email),
    find_staff_user_by_id: (id) => find_staff_user_by_id(pool, id),
    search_accounts: (args) => search_accounts(pool, args),
    find_account_by_id: (id) => find_account_by_id(pool, id),
    list_enforcement_actions: (account_id) => list_enforcement_actions(pool, account_id),
    list_audit_logs: (args) => list_audit_logs(pool, args),
    list_events: (args) => list_events(pool, args),
    find_current_mode: () => find_current_mode(pool),
    list_stats_days: (account_id, since_day) => list_stats_days(pool, account_id, since_day),
    list_event_days: (account_id, since_day) => list_event_days(pool, account_id, since_day),
    count_events_for_days: (account_id, since_day, days) =>
      count_events_for_days(pool, account_id, since_day, days),
    count_accounts_sharing_fingerprint: (account_id) =>
      count_accounts_sharing_fingerprint(pool, account_id),
    count_signups_from_same_ip: (account_id, window_minutes) =>
      count_signups_from_same_ip(pool, account_id, window_minutes),
    list_quick_risk: (account_ids, since_day, window_minutes) =>
      list_quick_risk(pool, account_ids, since_day, window_minutes),
  };
}
