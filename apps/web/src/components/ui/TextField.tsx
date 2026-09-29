import { useId } from "react";
import type { InputHTMLAttributes, ReactElement } from "react";

/** Props of `TextField`. Every native input attribute passes through, except `id`, `className` and `style`. */
export type TextFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "className" | "style"
> & {
  /** The visible label, tied to the input. */
  label: string;
};

/**
 * Renders a one-line input with its label.
 *
 * @param props - See `TextFieldProps`.
 */
export function TextField({ label, ...inputProps }: TextFieldProps): ReactElement {
  const inputId = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        className="rounded-md border border-line bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        {...inputProps}
      />
    </div>
  );
}
