import { Link } from "react-router-dom";
import type { ReactElement, ReactNode } from "react";

/** Props of `TextLink`. */
export type TextLinkProps = {
  /** A path inside the app, such as `/accounts/42`. */
  to: string;
  children: ReactNode;
};

/**
 * Renders a link to another page of the app.
 *
 * @param props - See `TextLinkProps`.
 */
export function TextLink({ to, children }: TextLinkProps): ReactElement {
  return (
    <Link
      to={to}
      className="rounded-sm text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </Link>
  );
}
