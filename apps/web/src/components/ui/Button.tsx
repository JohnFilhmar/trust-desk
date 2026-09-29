import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

/** Props of `Button`. Every native button attribute passes through, except `className` and `style`. */
export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "style"> & {
  /** `primary` is the main action of a view. `danger` is an action that is hard to undo. Defaults to `secondary`. */
  variant?: ButtonVariant;
};

const baseClasses =
  "inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";

const variantClasses: Readonly<Record<ButtonVariant, string>> = {
  primary: "border-accent bg-accent text-accent-ink hover:opacity-90",
  secondary: "border-line bg-surface text-ink hover:bg-canvas",
  danger: "border-risk-high bg-risk-high text-accent-ink hover:opacity-90",
};

/**
 * Renders a button in one of the app's three looks.
 *
 * @param props - See `ButtonProps`. `type` defaults to `button`, so a button inside a form submits only when asked to.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", type = "button", ...buttonProps },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${baseClasses} ${variantClasses[variant]}`}
      {...buttonProps}
    />
  );
});
