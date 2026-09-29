import { useMutation } from "@tanstack/react-query";
import { NavLink } from "react-router-dom";
import type { ReactElement, ReactNode } from "react";
import { ErrorState } from "@/components/ErrorState";
import { SyntheticDataBanner } from "@/components/SyntheticDataBanner";
import { Button } from "@/components/ui/Button";
import { staffGroupLabels } from "@/lib/format/labels";
import { useSession } from "@/providers/SessionProvider";

/** Props of `AppShell`. */
export type AppShellProps = {
  /** The page. */
  children: ReactNode;
};

function navLinkClasses({ isActive }: { isActive: boolean }): string {
  const baseClasses =
    "rounded-sm border-b-2 px-1 py-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  return isActive
    ? `${baseClasses} border-accent text-ink`
    : `${baseClasses} border-transparent text-ink-muted hover:text-ink`;
}

/**
 * Frames every signed-in page with the banner, the top bar and the navigation.
 *
 * @param props - See `AppShellProps`.
 */
export function AppShell({ children }: AppShellProps): ReactElement {
  const { user, signOut, can } = useSession();
  const signOutMutation = useMutation({ mutationFn: signOut });

  return (
    <div className="flex min-h-screen min-w-7xl flex-col">
      <header className="border-b border-line bg-surface">
        <SyntheticDataBanner />
        <div className="mx-auto flex max-w-7xl items-center gap-8 px-8 py-3">
          <p className="text-lg font-semibold">Trust Desk</p>
          <nav aria-label="Main" className="flex flex-1 items-center gap-6">
            <NavLink to="/accounts" className={navLinkClasses}>
              Accounts
            </NavLink>
            {can("audit.read") && (
              <NavLink to="/audit" className={navLinkClasses}>
                Audit trail
              </NavLink>
            )}
          </nav>
          {user !== null && (
            <p className="text-sm">
              <span className="font-medium">{user.display_name}</span>
              <span className="text-ink-muted">, {staffGroupLabels[user.group_name]}</span>
            </p>
          )}
          <Button
            disabled={signOutMutation.isPending}
            onClick={() => {
              signOutMutation.mutate();
            }}
          >
            {signOutMutation.isPending ? "Signing out" : "Sign out"}
          </Button>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-8 py-8">
        {signOutMutation.isError && (
          <ErrorState error={signOutMutation.error} heading="Sign out failed" />
        )}
        {children}
      </main>
    </div>
  );
}
