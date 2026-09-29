/** Where and how to show a timestamp. Both default to the viewer's own settings. */
export type TimestampFormatOptions = {
  /** A BCP 47 tag such as `en-GB`. */
  locale?: string;
  /** An IANA zone such as `Asia/Manila`. */
  timeZone?: string;
};

/**
 * Formats a UTC timestamp from the API in the viewer's local time zone.
 *
 * @param value - An ISO 8601 string in UTC. Fractional digits past milliseconds are dropped.
 * @param options - Overrides for the locale and the zone. Tests set both.
 * @returns The date and the time to the second. A value that is not a date comes back unchanged.
 */
export function formatTimestamp(value: string, options: TimestampFormatOptions = {}): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(options.locale, {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: options.timeZone,
  }).format(date);
}

/**
 * Formats a UTC timestamp from the API as plain UTC text.
 *
 * @param value - An ISO 8601 string in UTC.
 * @returns Text such as `2026-09-30 01:02:03 UTC`. A value that is not a date comes back unchanged.
 */
export function formatUtcTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}
