import { describe, expect, it, jest } from "@jest/globals";
import type { StaffGroup } from "@trust-desk/shared";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ApiClient } from "@/lib/api/apiClient";
import {
  buildAccount,
  buildApiError,
  buildRevealedAccount,
  buildSession,
  correlationId,
} from "@/testUtils/fixtures";
import { buildApiClient, renderRoutes } from "@/testUtils/renderWithProviders";

function signedOut(): Promise<never> {
  return Promise.reject(buildApiError(401, "unauthenticated", "Sign in to continue."));
}

function signedInAs(group: StaffGroup): ApiClient["fetchSession"] {
  return () => Promise.resolve(buildSession(group));
}

const emptyAudit: ApiClient["fetchAuditLogs"] = () => Promise.resolve({ items: [] });
const emptyAccounts: ApiClient["searchAccounts"] = () =>
  Promise.resolve({ items: [], next_cursor: null });

describe("routes", () => {
  it("sends a signed-out visitor to the login page, then back to where they were going", async () => {
    const user = userEvent.setup();
    renderRoutes({
      apiClient: buildApiClient({
        fetchSession: signedOut,
        login: () => Promise.resolve(buildSession("analyst")),
        fetchAuditLogs: emptyAudit,
      }),
      route: "/audit",
    });

    await user.click(await screen.findByRole("button", { name: "Sign in as Demo Analyst" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Audit trail" })).toBeTruthy();
  });

  it("redirects the root path to the accounts page", async () => {
    renderRoutes({
      apiClient: buildApiClient({
        fetchSession: signedInAs("viewer"),
        searchAccounts: emptyAccounts,
      }),
      route: "/",
    });

    expect(await screen.findByRole("heading", { level: 1, name: "Accounts" })).toBeTruthy();
  });

  it("shows the shell with the user's name and group, and the synthetic data banner", async () => {
    renderRoutes({
      apiClient: buildApiClient({
        fetchSession: signedInAs("enforcer"),
        searchAccounts: emptyAccounts,
      }),
      route: "/accounts",
    });

    expect(await screen.findByText("Demo enforcer")).toBeTruthy();
    expect(screen.getByText(", Enforcer")).toBeTruthy();
    expect(screen.getByText(/Demo with synthetic data/)).toBeTruthy();
    const navigation = screen.getByRole("navigation", { name: "Main" });
    expect(navigation.textContent).toContain("Accounts");
    expect(navigation.textContent).toContain("Audit trail");
  });

  it("signs out and returns to the login page", async () => {
    const user = userEvent.setup();
    const logout = jest.fn<ApiClient["logout"]>().mockResolvedValue(undefined);
    renderRoutes({
      apiClient: buildApiClient({
        fetchSession: signedInAs("viewer"),
        searchAccounts: emptyAccounts,
        logout,
      }),
      route: "/accounts",
    });

    await user.click(await screen.findByRole("button", { name: "Sign out" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Sign in to Trust Desk" }),
    ).toBeTruthy();
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("sends the visitor to the login page when a read answers 401", async () => {
    renderRoutes({
      apiClient: buildApiClient({
        fetchSession: signedInAs("viewer"),
        searchAccounts: signedOut,
      }),
      route: "/accounts",
    });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Sign in to Trust Desk" }),
    ).toBeTruthy();
  });

  it("shows an error, not the login page, when the session cannot be read", async () => {
    renderRoutes({
      apiClient: buildApiClient({
        fetchSession: () =>
          Promise.reject(buildApiError(400, "invalid_request", "The request was not valid.")),
      }),
      route: "/accounts",
    });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Your session could not be checked");
    expect(alert.textContent).toContain(correlationId);
  });

  it("clears every cached answer and every revealed value on sign out", async () => {
    const user = userEvent.setup();
    const masked = buildAccount();
    const unmasked = buildRevealedAccount();
    const fetchAccount = jest
      .fn<ApiClient["fetchAccount"]>()
      .mockResolvedValueOnce({ account: masked, enforcement_actions: [] })
      .mockReturnValue(new Promise(() => undefined));
    renderRoutes({
      apiClient: buildApiClient({
        fetchSession: signedInAs("analyst"),
        login: () => Promise.resolve(buildSession("analyst")),
        logout: () => Promise.resolve(),
        fetchAccount,
        revealAccountPii: () => Promise.resolve({ account: unmasked, audit_log_id: 7 }),
      }),
      route: "/accounts/42",
    });
    await user.click(await screen.findByRole("button", { name: "Reveal PII" }));
    await user.type(screen.getByLabelText("Reason"), "Checking a report against this signup.");
    await user.click(screen.getByRole("button", { name: "Reveal" }));
    expect(await screen.findByText(unmasked.email)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await user.click(await screen.findByRole("button", { name: "Sign in as Demo Analyst" }));

    // A cache that survived the sign out would show the account at once.
    // The second request never answers, so only a cleared cache shows loading.
    expect(await screen.findByText("Loading the account")).toBeTruthy();
    expect(fetchAccount).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(unmasked.email)).toBeNull();
    expect(screen.queryByText(masked.email)).toBeNull();
    expect(screen.queryByText("Revealed")).toBeNull();
  });

  it("shows the not-found page for an unknown path", async () => {
    renderRoutes({
      apiClient: buildApiClient({ fetchSession: signedOut }),
      route: "/nowhere",
    });

    expect(await screen.findByRole("heading", { level: 1, name: "Page not found" })).toBeTruthy();
  });
});
