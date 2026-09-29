import type { Clock } from "#app/interfaces/deps.ts";

export type ThrottleSettings = {
  /** Failed logins allowed from one IP inside the window. */
  max_failures: number;
  window_seconds: number;
  /** The most IPs remembered at once, so the map cannot grow without end. */
  max_tracked_ips: number;
  clock: Clock;
};

export type ThrottleDecision =
  | { allowed: true }
  | { allowed: false; retry_after_seconds: number };

/** Counts failed logins per client IP. */
export interface LoginThrottle {
  /**
   * Decides whether an IP may try to log in.
   *
   * @param ip - The client IP.
   * @returns Allowed, or refused with the seconds until the oldest failure
   *   leaves the window.
   */
  check(ip: string): ThrottleDecision;

  /**
   * Records one failed login.
   *
   * @param ip - The client IP.
   */
  record_failure(ip: string): void;
}

/**
 * Builds the login throttle.
 *
 * It counts by client IP and never by account. Locking an account after
 * failed logins would let a stranger lock the demo users out.
 *
 * Limit: the counts live in this process. They are lost on restart, they
 * are not shared between two instances, and on AWS Lambda each invocation
 * could land on a fresh process and see an empty map. Replacement: a store
 * shared by every instance, such as a DynamoDB table with a TTL or Redis,
 * behind this same interface.
 *
 * @param settings - The limit, the window and the clock.
 * @returns A throttle that keeps the time of each failure per IP.
 */
export function create_login_throttle(settings: ThrottleSettings): LoginThrottle {
  const failures = new Map<string, number[]>();
  const window_ms = settings.window_seconds * 1000;

  function recent(ip: string, now: number): number[] {
    const kept = (failures.get(ip) ?? []).filter((time) => now - time < window_ms);
    if (kept.length === 0) failures.delete(ip);
    else failures.set(ip, kept);
    return kept;
  }

  function make_room(now: number): void {
    if (failures.size < settings.max_tracked_ips) return;
    for (const ip of [...failures.keys()]) recent(ip, now);
    // A Map keeps insertion order, so the first key is the oldest IP.
    while (failures.size >= settings.max_tracked_ips) {
      const oldest = failures.keys().next().value;
      if (oldest === undefined) return;
      failures.delete(oldest);
    }
  }

  return {
    check(ip) {
      const now = settings.clock.now().getTime();
      const kept = recent(ip, now);
      const oldest = kept[0];
      if (kept.length < settings.max_failures || oldest === undefined) {
        return { allowed: true };
      }
      return {
        allowed: false,
        retry_after_seconds: Math.max(1, Math.ceil((oldest + window_ms - now) / 1000)),
      };
    },

    record_failure(ip) {
      const now = settings.clock.now().getTime();
      const kept = recent(ip, now);
      if (kept.length === 0) make_room(now);
      failures.set(ip, [...kept, now]);
    },
  };
}
