import type { ReactElement, ReactNode } from "react";
import type { ApiClient } from "@/lib/api/apiClient";
import { ApiClientProvider } from "@/providers/ApiClientProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { SessionProvider } from "@/providers/SessionProvider";

/** Props of `RootProvider`. */
export type RootProviderProps = {
  /** Replaces the client that calls the real API. Only tests set it. */
  apiClient?: ApiClient;
  children: ReactNode;
};

/**
 * Composes every provider of the app, in the order they depend on each other.
 *
 * @param props - See `RootProviderProps`.
 */
export function RootProvider({ apiClient, children }: RootProviderProps): ReactElement {
  return (
    <ApiClientProvider apiClient={apiClient}>
      <QueryProvider>
        <SessionProvider>{children}</SessionProvider>
      </QueryProvider>
    </ApiClientProvider>
  );
}
