import type {
  AuditLogEntry,
  EnforcementAction,
  EnforcementResult,
  InternalEnforcementRequest,
} from "@trust-desk/shared";
import type {
  AccountRow,
  AccountSearchArgs,
  AuditLogArgs,
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
   * @param args - The filter, the position to start after, and the page size.
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
export type CoreApiResult =
  | { kind: "ok"; result: EnforcementResult }
  | { kind: "rejected"; status: number; code: string }
  | { kind: "unavailable"; reason: string };

/** The signed calls to Rails. */
export interface CoreApi {
  /**
   * Asks Rails to suspend an account.
   *
   * @param account_id - The account to suspend.
   * @param body - The acting staff user and the reason. It is signed as sent.
   * @param correlation_id - Passed on so both services log the same id.
   * @returns `ok` with the result, `rejected` when Rails refused on the
   *   merits, or `unavailable` on a timeout, a network error or anything
   *   unexpected. Never throws.
   */
  suspend_account(
    account_id: number,
    body: InternalEnforcementRequest,
    correlation_id: string,
  ): Promise<CoreApiResult>;
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
  clock: Clock;
  logger: Logger;
  config: HandlerConfig;
}
