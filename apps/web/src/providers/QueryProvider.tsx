import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { ApiError } from "@/lib/api/apiError";
import { sessionKey } from "@/lib/api/queryKeys";

/** Props of `QueryProvider`. */
export type QueryProviderProps = {
  children: ReactNode;
};

function shouldRetryQuery(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 2;
}

function createQueryClient(): QueryClient {
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        // A 401 on any read means the session ended. Clearing the session
        // query makes the route guard send the visitor to the login page.
        if (error instanceof ApiError && error.status === 401) {
          queryClient.setQueryData(sessionKey(), null);
        }
      },
    }),
    defaultOptions: {
      queries: { retry: shouldRetryQuery },
      mutations: { retry: false },
    },
  });
  return queryClient;
}

/**
 * Holds the TanStack Query cache for every component below it.
 *
 * @param props - See `QueryProviderProps`.
 */
export function QueryProvider({ children }: QueryProviderProps): ReactElement {
  const [queryClient] = useState(createQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
