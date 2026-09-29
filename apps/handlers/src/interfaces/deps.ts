/** The read-side queries a handler may run. Handlers never see SQL or the pool. */
export interface Database {
  /**
   * Checks that MySQL answers.
   *
   * @returns `true` when a trivial query succeeds, `false` on any failure. Never throws.
   */
  ping(): Promise<boolean>;
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

/** Everything a handler needs from outside itself. Built once in `server.ts`. */
export interface Deps {
  db: Database;
  clock: Clock;
  logger: Logger;
}
