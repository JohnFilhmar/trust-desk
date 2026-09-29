import type {
  AuditLogEntry,
  EnforcementAction,
  EnforcementActionType,
  EnforcementResult,
  InternalEnforcementRequest,
  InternalModeChangeRequest,
  InternalModeChangeResult,
  InternalRevealRequest,
  InternalRevealResult,
} from "@trust-desk/shared";
import type { LoginThrottle } from "#app/lib/rate_limit/login_throttle.ts";
import type { DailyCounts, EventDay, StatsDay } from "#app/lib/risk/merge_daily_counts.ts";
import type {
  AccountRow,
  AccountSearchArgs,
  AuditLogArgs,
  CurrentModeRow,
  EventListArgs,
  EventRow,
  QuickRiskRow,
  StaffCredentialsRow,
  StaffUserRow,
} from "#app/types/rows.ts";

/** The read-side queries a handler may run. Handlers never see SQL or the pool. */
export interface Database {
  /**
   * Checks that MySQL answers.
   *
   * @returns `true` when a trivial query succeeds, `false` on any failure. Never throws.
   */
  ping(): Promise<boolean>;

  /**
   * Finds a staff user for login.
   *
   * @param email - Compared exactly as stored.
   * @returns The user with the password hash, or `null` when no user has that email.
   */
  find_staff_credentials_by_email(email: string): Promise<StaffCredentialsRow | null>;

  /**
   * Finds a staff user for an existing session.
   *
   * @param id - The id read from the session cookie.
   * @returns The user without the password hash, or `null` when it no longer exists.
   */
  find_staff_user_by_id(id: number): Promise<StaffUserRow | null>;

  /**
   * Lists accounts, newest first.
   *
   * @param args - The filters, the position to start after, and the page size.
   * @returns At most `limit` rows, with raw PII. An empty array when none match.
   */
  search_accounts(args: AccountSearchArgs): Promise<AccountRow[]>;

  /**
   * Finds one account.
   *
   * @param id - The account id.
   * @returns The account with raw PII, or `null` when it does not exist.
   */
  find_account_by_id(id: number): Promise<AccountRow | null>;

  /**
   * Lists the actions taken against one account, newest first.
   *
   * @param account_id - The account id.
   * @returns Every action. An empty array when there are none.
   */
  list_enforcement_actions(account_id: number): Promise<EnforcementAction[]>;

  /**
   * Lists audit rows, newest first.
   *
   * @param args - An optional account to filter by, and the page size.
   * @returns At most `limit` rows.
   */
  list_audit_logs(args: AuditLogArgs): Promise<AuditLogEntry[]>;

  /**
   * Lists the events of one account, newest first.
   *
   * @param args - The account, an optional event type, the position to
   *   start after, and the page size.
   * @returns At most `limit` rows, each with its raw payload.
   */
  list_events(args: EventListArgs): Promise<EventRow[]>;

  /**
   * Reads the operational mode in force.
   *
   * @returns The newest row, or `null` when no mode was ever set.
   */
  find_current_mode(): Promise<CurrentModeRow | null>;

  /**
   * Reads the pre-aggregated rows of one account.
   *
   * @param account_id - The account id.
   * @param since_day - The first UTC day of the window, as `YYYY-MM-DD`.
   * @returns One row per day that has one.
   */
  list_stats_days(account_id: number, since_day: string): Promise<StatsDay[]>;

  /**
   * Finds the newest event of each day of one account.
   *
   * @param account_id - The account id.
   * @param since_day - The first UTC day of the window, as `YYYY-MM-DD`.
   * @returns One row per day that has events.
   */
  list_event_days(account_id: number, since_day: string): Promise<EventDay[]>;

  /**
   * Counts raw events for the given days. This is the fallback path.
   *
   * @param account_id - The account id.
   * @param since_day - The first UTC day of the window, as `YYYY-MM-DD`.
   * @param days - The days to count. An empty list returns an empty array.
   * @returns One row per requested day that has events.
   */
  count_events_for_days(
    account_id: number,
    since_day: string,
    days: readonly string[],
  ): Promise<DailyCounts[]>;

  /**
   * Counts the other accounts that signed up with the same device fingerprint.
   *
   * @param account_id - The account id.
   * @returns How many accounts share it, this one not included.
   */
  count_accounts_sharing_fingerprint(account_id: number): Promise<number>;

  /**
   * Counts the accounts that signed up from the same IP around the same time.
   *
   * @param account_id - The account id.
   * @param window_minutes - How far before and after this signup to look.
   * @returns How many accounts, this one included.
   */
  count_signups_from_same_ip(account_id: number, window_minutes: number): Promise<number>;

  /**
   * Reads what a list needs to score a page of accounts, in one query.
   *
   * @param account_ids - The accounts on the page.
   * @param since_day - The first UTC day of the window, as `YYYY-MM-DD`.
   * @param window_minutes - The signup velocity window.
   * @returns One row per account that exists.
   */
  list_quick_risk(
    account_ids: readonly number[],
    since_day: string,
    window_minutes: number,
  ): Promise<QuickRiskRow[]>;
}

/** Password checking, injected so tests need no bcrypt. */
export interface Auth {
  /**
   * Compares a password with a bcrypt hash.
   *
   * @param password - What the user typed.
   * @param digest - The hash Rails stored, or `null` when no user matched.
   *   With `null` the work of a comparison is still done, against a hash
   *   nobody knows the password of, and the answer is always `false`.
   * @returns `true` on a match. `false` on a mismatch or a malformed hash.
   */
  verify_password(password: string, digest: string | null): Promise<boolean>;
}

/** What came back from Rails, already sorted into the three cases that matter. */
export type CoreApiResult<Result> =
  | { kind: "ok"; result: Result }
  | { kind: "rejected"; status: number; code: string }
  | { kind: "unavailable"; reason: string };

/**
 * The signed calls to Rails. Every method returns `ok` with the result,
 * `rejected` when Rails refused on the merits, or `unavailable` on a
 * timeout, a network error or anything unexpected. None of them throws.
 */
export interface CoreApi {
  /**
   * Asks Rails to act on an account.
   *
   * @param action - Suspend, unsuspend or mark as spam.
   * @param account_id - The account to act on.
   * @param body - The acting staff user, the reason and the idempotency key. It is signed as sent.
   * @param correlation_id - Passed on so both services log the same id.
   * @returns What Rails recorded.
   */
  enforce(
    action: EnforcementActionType,
    account_id: number,
    body: InternalEnforcementRequest,
    correlation_id: string,
  ): Promise<CoreApiResult<EnforcementResult>>;

  /**
   * Asks Rails to write the audit row of a PII reveal. The caller unmasks
   * nothing until this returns `ok`.
   *
   * @param body - The acting staff user, the account, the fields and the reason.
   * @param correlation_id - Passed on so both services log the same id.
   * @returns The id of the audit row.
   */
  record_reveal(
    body: InternalRevealRequest,
    correlation_id: string,
  ): Promise<CoreApiResult<InternalRevealResult>>;

  /**
   * Asks Rails to change the operational mode.
   *
   * @param body - The acting staff user, the new mode and the reason.
   * @param correlation_id - Passed on so both services log the same id.
   * @returns The new row and the id of its audit row.
   */
  change_mode(
    body: InternalModeChangeRequest,
    correlation_id: string,
  ): Promise<CoreApiResult<InternalModeChangeResult>>;
}

/** The source of the current time, injected so tests can fix it. */
export interface Clock {
  /** @returns The current moment. */
  now(): Date;
}

/** The subset of a logger the handlers use. Matches pino's call shape. */
export interface Logger {
  /**
   * @param fields - Structured fields. Ids only, never emails, IPs or fingerprints.
   * @param message - A short fixed sentence.
   */
  info(fields: Record<string, unknown>, message: string): void;
  /**
   * @param fields - Structured fields. Ids only, never emails, IPs or fingerprints.
   * @param message - A short fixed sentence.
   */
  warn(fields: Record<string, unknown>, message: string): void;
  /**
   * @param fields - Structured fields. Ids only, never emails, IPs or fingerprints.
   * @param message - A short fixed sentence.
   */
  error(fields: Record<string, unknown>, message: string): void;
}

/** Settings the handlers read. Built once from the validated environment. */
export type HandlerConfig = {
  session_secret: string;
  /** Origins allowed to send a state-changing request. */
  allowed_origins: readonly string[];
  /** Whether the session cookie carries `Secure`. */
  secure_cookies: boolean;
};

/** Everything a handler needs from outside itself. Built once in `server.ts`. */
export interface Deps {
  db: Database;
  auth: Auth;
  core_api: CoreApi;
  login_throttle: LoginThrottle;
  clock: Clock;
  logger: Logger;
  config: HandlerConfig;
}
