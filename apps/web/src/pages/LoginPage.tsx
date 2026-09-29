import { demo_password } from "@trust-desk/shared";
import { useMutation } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { DemoAccountsPanel } from "@/components/DemoAccountsPanel";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { LoginForm } from "@/components/LoginForm";
import { SyntheticDataBanner } from "@/components/SyntheticDataBanner";
import { ApiError } from "@/lib/api/apiError";
import { readReturnPath } from "@/lib/navigation/readReturnPath";
import { useSession } from "@/providers/SessionProvider";

const genericRefusal = "The email or password is not correct.";

// The server's own wording is never shown for a refused sign-in, so the page
// cannot say which of the two values was wrong.
function describeRefusal(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) {
    return undefined;
  }
  if (error.status === 401 || error.status === 422) {
    return genericRefusal;
  }
  if (error.status !== 429) {
    return undefined;
  }
  if (error.retryAfterSeconds === null) {
    return "Too many sign-in attempts. Wait a minute, then try again.";
  }
  const wait =
    error.retryAfterSeconds === 1 ? "1 second" : `${error.retryAfterSeconds} seconds`;
  return `Too many sign-in attempts. Wait ${wait}, then try again.`;
}

/**
 * Signs a staff user in, by form or by one of the demo accounts, then sends
 * them to the page they asked for.
 */
export function LoginPage(): ReactElement {
  const { user, isLoading, signIn } = useSession();
  const location = useLocation();
  const signInMutation = useMutation({ mutationFn: signIn });

  if (user !== null) {
    const state: unknown = location.state;
    return <Navigate to={readReturnPath(state)} replace />;
  }

  const { error } = signInMutation;

  return (
    <div className="flex min-h-screen min-w-7xl flex-col">
      <header>
        <SyntheticDataBanner />
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-8 py-16">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Sign in to Trust Desk</h1>
          <p className="text-ink-muted">Trust and Safety investigation console.</p>
        </div>
        {signInMutation.isError && (
          <ErrorState error={error} heading="Sign in failed" message={describeRefusal(error)} />
        )}
        {isLoading ? (
          <LoadingState label="Checking your session" />
        ) : (
          <div className="grid grid-cols-2 items-start gap-8">
            <LoginForm onSubmit={signInMutation.mutate} isBusy={signInMutation.isPending} />
            <DemoAccountsPanel
              onSignIn={(account) => {
                signInMutation.mutate({ email: account.email, password: demo_password });
              }}
              isBusy={signInMutation.isPending}
            />
          </div>
        )}
      </main>
    </div>
  );
}
