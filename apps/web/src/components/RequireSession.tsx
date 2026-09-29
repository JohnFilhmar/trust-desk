import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { ReactElement } from "react";
import { AppShell } from "@/components/AppShell";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { useSession } from "@/providers/SessionProvider";

/**
 * Guards the signed-in routes. A signed-out visitor goes to the login page,
 * which sends them back to the path they asked for once they sign in.
 */
export function RequireSession(): ReactElement {
  const { user, isLoading, error } = useSession();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-8 py-8">
        <LoadingState label="Checking your session" />
      </div>
    );
  }
  if (error !== null) {
    return (
      <div className="mx-auto max-w-7xl px-8 py-8">
        <ErrorState error={error} heading="Your session could not be checked" />
      </div>
    );
  }
  if (user === null) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ returnPath: `${location.pathname}${location.search}` }}
      />
    );
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
