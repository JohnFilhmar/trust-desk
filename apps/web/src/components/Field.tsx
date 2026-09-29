import type { ReactElement, ReactNode } from "react";

/** Props of `Field`. */
export type FieldProps = {
  /** The name of the value. */
  label: string;
  /** The value. */
  children: ReactNode;
};

/**
 * Renders one named value. It belongs inside a `dl` element.
 *
 * @param props - See `FieldProps`.
 */
export function Field({ label, children }: FieldProps): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  );
}
