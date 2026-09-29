import type { ReactElement } from "react";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import type { ApiClient } from "@/lib/api/apiClient";
import { RootProvider } from "@/providers/RootProvider";
import { routes } from "@/routes";

const router = createBrowserRouter(routes, {
  future: {
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_relativeSplatPath: true,
    v7_skipActionErrorRevalidation: true,
  },
});

/** Props of `App`. */
export type AppProps = {
  /** Replaces the client that calls the real API. Only tests set it. */
  apiClient?: ApiClient;
};

/**
 * The root of the console: the providers around the router.
 *
 * @param props - See `AppProps`.
 */
export function App({ apiClient }: AppProps): ReactElement {
  return (
    <RootProvider apiClient={apiClient}>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </RootProvider>
  );
}
