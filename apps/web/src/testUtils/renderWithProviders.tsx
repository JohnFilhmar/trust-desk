import { render } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, useRoutes } from "react-router-dom";
import type { MemoryRouterProps } from "react-router-dom";
import type { ApiClient } from "@/lib/api/apiClient";
import { RootProvider } from "@/providers/RootProvider";
import { routes } from "@/routes";
import { buildOperationalMode, buildRiskScore } from "@/testUtils/fixtures";

type RenderOptions = {
  apiClient: ApiClient;
  route?: NonNullable<MemoryRouterProps["initialEntries"]>[number];
};

function notStubbed(name: string): () => Promise<never> {
  return () => Promise.reject(new Error(`${name} was called, and the test gave it no answer.`));
}

/** The app's real route table, for a test that renders something beside it. */
export function AppRoutes(): ReactElement | null {
  return useRoutes(routes);
}

/**
 * Builds an API client for a test. A call the test did not answer rejects,
 * so a test never reaches the network by accident. Three reads are the
 * exception, because the shell and the account page make them on every
 * render: the mode answers normal, the risk answers a fixed score, and the
 * timeline answers empty.
 */
export function buildApiClient(answers: Partial<ApiClient>): ApiClient {
  return {
    login: notStubbed("login"),
    logout: notStubbed("logout"),
    fetchSession: notStubbed("fetchSession"),
    searchAccounts: notStubbed("searchAccounts"),
    fetchAccount: notStubbed("fetchAccount"),
    fetchAccountRisk: () => Promise.resolve(buildRiskScore()),
    fetchAccountEvents: () => Promise.resolve({ items: [], next_cursor: null }),
    revealAccountPii: notStubbed("revealAccountPii"),
    suspendAccount: notStubbed("suspendAccount"),
    unsuspendAccount: notStubbed("unsuspendAccount"),
    markAccountAsSpam: notStubbed("markAccountAsSpam"),
    fetchAuditLogs: notStubbed("fetchAuditLogs"),
    fetchOperationalMode: () => Promise.resolve(buildOperationalMode()),
    changeOperationalMode: notStubbed("changeOperationalMode"),
    ...answers,
  };
}

/**
 * Renders inside the app's own providers and a memory router. The memory
 * router is used because jsdom has no `Request`, which the data router needs
 * to navigate.
 */
export function renderWithProviders(ui: ReactElement, options: RenderOptions): RenderResult {
  return render(
    <RootProvider apiClient={options.apiClient}>
      <MemoryRouter
        initialEntries={[options.route ?? "/"]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        {ui}
      </MemoryRouter>
    </RootProvider>,
  );
}

/**
 * Renders the app's real route table at a path, with the guard and the shell
 * around the page, as the browser shows it.
 */
export function renderRoutes(options: RenderOptions): RenderResult {
  return renderWithProviders(<AppRoutes />, options);
}
