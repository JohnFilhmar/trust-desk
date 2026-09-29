import { render } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, useRoutes } from "react-router-dom";
import type { MemoryRouterProps } from "react-router-dom";
import type { ApiClient } from "@/lib/api/apiClient";
import { RootProvider } from "@/providers/RootProvider";
import { routes } from "@/routes";

type RenderOptions = {
  apiClient: ApiClient;
  route?: NonNullable<MemoryRouterProps["initialEntries"]>[number];
};

function notStubbed(name: string): () => Promise<never> {
  return () => Promise.reject(new Error(`${name} was called, and the test gave it no answer.`));
}

function AppRoutes(): ReactElement | null {
  return useRoutes(routes);
}

/**
 * Builds an API client for a test. A call the test did not answer rejects,
 * so a test never reaches the network by accident.
 */
export function buildApiClient(answers: Partial<ApiClient>): ApiClient {
  return {
    login: notStubbed("login"),
    logout: notStubbed("logout"),
    fetchSession: notStubbed("fetchSession"),
    searchAccounts: notStubbed("searchAccounts"),
    fetchAccount: notStubbed("fetchAccount"),
    suspendAccount: notStubbed("suspendAccount"),
    fetchAuditLogs: notStubbed("fetchAuditLogs"),
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
