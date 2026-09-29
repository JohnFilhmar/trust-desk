import type { ReactElement } from "react";

/** Props of `PayloadList`. */
export type PayloadListProps = {
  /** The payload of an event, as the server sent it. Its values can be anything JSON holds. */
  payload: Record<string, unknown>;
};

function describeValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null || value === undefined) {
    return "None";
  }
  // Only objects and arrays are left, since the payload came from JSON.
  return JSON.stringify(value);
}

/**
 * Lists the keys and values of an event payload. A nested object or an
 * array is shown as JSON text.
 *
 * @param props - See `PayloadListProps`. An empty payload shows one line saying so.
 */
export function PayloadList({ payload }: PayloadListProps): ReactElement {
  const entries = Object.entries(payload);
  if (entries.length === 0) {
    return <p className="text-sm text-ink-muted">No details</p>;
  }
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-2 text-sm">
          <dt className="text-ink-muted">{key}</dt>
          <dd className="font-mono break-all">{describeValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
