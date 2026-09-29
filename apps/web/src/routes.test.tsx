import { describe, expect, it, jest } from "@jest/globals";
import type { StaffGroup } from "@trust-desk/shared";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ApiClient } from "@/lib/api/apiClient";
import { buildApiError, buildSession, correlationId } from "@/testUtils/fixtures";
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

  it("shows the audit entries with the reason narrowed from details", async () => {
    renderRoutes({
      apiClient: buildApiClient({
        fetchSession: signedInAs("viewer"),
        fetchAuditLogs: () =>
          Promise.resolve({
            items: [
              {
                id: 9,
                action: "account.suspend",
                actor: { id: 3, display_name: "Demo Enforcer" },
                account_id: 42,
                details: { reason: "Twelve accounts share this fingerprint." },
                correlation_id: correlationId,
                created_at: "2026-09-30T01:02:03.456789Z",
              },
              {
                id: 8,
                action: "mode.change",
                actor: { id: 3, display_name: "Demo Enforcer" },
                account_id: null,
                details: { reason: 12 },
                correlation_id: correlationId,
                created_at: "2026-09-29T01:02:03.456789Z",
              },
            ],
          }),
      }),
      route: "/audit",
    });

    expect(await screen.findByText("Twelve accounts share this fingerprint.")).toBeTruthy();
    expect(screen.getByText("Suspended an account")).toBeTruthy();
    expect(screen.getByText("Changed the operational mode")).toBeTruthy();
    const accountLinks = screen.getAllByRole("link", { name: "Account 42" });
    expect(accountLinks).toHaveLength(1);
    expect(accountLinks[0]?.getAttribute("href")).toBe("/accounts/42");
    expect(screen.queryByText("12")).toBeNull();
  });

  it("shows the not-found page for an unknown path", async () => {
    renderRoutes({
      apiClient: buildApiClient({ fetchSession: signedOut }),
      route: "/nowhere",
    });

    expect(await screen.findByRole("heading", { level: 1, name: "Page not found" })).toBeTruthy();
  });
});
