import type { ReactElement } from "react";
import { formatTimestamp, formatUtcTimestamp } from "@/lib/format/formatTimestamp";

/** Props of `Timestamp`. */
export type TimestampProps = {
  /** A UTC ISO 8601 string, exactly as the API sent it. */
  value: string;
};

/**
 * Shows a moment in the viewer's local time, with the UTC value on hover.
 *
 * @param props - See `TimestampProps`.
 */
export function Timestamp({ value }: TimestampProps): ReactElement {
  return (
    <time dateTime={value} title={formatUtcTimestamp(value)}>
      {formatTimestamp(value)}
    </time>
  );
}
