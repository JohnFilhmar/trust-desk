import { has_permission } from "@trust-desk/shared";
import type { LoginRequest, Permission, SessionUser } from "@trust-desk/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo } from "react";
import type { ReactElement, ReactNode } from "react";
import { ApiError } from "@/lib/api/apiError";
import { sessionKey } from "@/lib/api/queryKeys";
import { useApiClient } from "@/providers/ApiClientProvider";

/** What `useSession` returns. */
export type SessionContextValue = {
  /** The signed-in staff user, or null when nobody is signed in or the session is still loading. */
  user: SessionUser | null;
  /** True until the first answer about the session arrives. */
  isLoading: boolean;
  /** Set when the session could not be read. A 401 is not an error, it means signed out. */
  error: Error | null;
  /** Signs in and stores the user. Rejects with an `ApiError` when the server refuses. */
  signIn: (credentials: LoginRequest) => Promise<void>;
  /** Signs out and drops every cached answer. Rejects with an `ApiError` when the request fails. */
  signOut: () => Promise<void>;
  /** Tells whether the signed-in user holds a permission. False when nobody is signed in. */
  can: (permission: Permission) => boolean;
};

/** Props of `SessionProvider`. */
export type SessionProviderProps = {
  children: ReactNode;
};

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Loads the session once and shares it with every component below it.
 *
 * @param props - See `SessionProviderProps`.
 */
export function SessionProvider({ children }: SessionProviderProps): ReactElement {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: sessionKey(),
    queryFn: async () => {
      try {
        return await apiClient.fetchSession();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return null;
        }
        throw error;
      }
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const dropServerData = useCallback((): void => {
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionKey()[0] });
  }, [queryClient]);

  const user = sessionQuery.data?.user ?? null;
  const { isPending, error } = sessionQuery;

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      isLoading: isPending,
      error,
      signIn: async (credentials) => {
        const session = await apiClient.login(credentials);
        // The cache may still hold what the previous user was allowed to see.
        dropServerData();
        queryClient.setQueryData(sessionKey(), session);
      },
      signOut: async () => {
        await apiClient.logout();
        queryClient.setQueryData(sessionKey(), null);
        dropServerData();
      },
      can: (permission) => user !== null && has_permission(user.group_name, permission),
    }),
    [apiClient, dropServerData, error, isPending, queryClient, user],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/**
 * Reads the session.
 *
 * @returns The signed-in user and the actions on the session.
 * @throws {Error} When no `SessionProvider` is above the caller.
 */
export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error("useSession needs a SessionProvider above it.");
  }
  return value;
}
