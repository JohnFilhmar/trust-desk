import { createContext, useContext } from "react";
import type { ReactElement, ReactNode } from "react";
import { apiClient as browserApiClient } from "@/lib/api/apiClient";
import type { ApiClient } from "@/lib/api/apiClient";

const ApiClientContext = createContext<ApiClient>(browserApiClient);

/** Props of `ApiClientProvider`. */
export type ApiClientProviderProps = {
  /** The client every component below uses. Defaults to the one that calls the real API. */
  apiClient?: ApiClient;
  children: ReactNode;
};

/**
 * Hands the API client to every component below it.
 *
 * @param props - See `ApiClientProviderProps`.
 */
export function ApiClientProvider({
  apiClient = browserApiClient,
  children,
}: ApiClientProviderProps): ReactElement {
  return <ApiClientContext.Provider value={apiClient}>{children}</ApiClientContext.Provider>;
}

/**
 * Reads the API client.
 *
 * @returns The client from the nearest `ApiClientProvider`, or the real one when there is none.
 */
export function useApiClient(): ApiClient {
  return useContext(ApiClientContext);
}
