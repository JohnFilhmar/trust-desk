import { describe, expect, it } from "@jest/globals";
import type { AuditLogEntry } from "@trust-desk/shared";
import { screen, within } from "@testing-library/react";
import { buildApiError, buildSession, correlationId } from "@/testUtils/fixtures";
import { buildApiClient, renderRoutes } from "@/testUtils/renderWithProviders";

function buildEntry(overrides: Partial<AuditLogEntry>): AuditLogEntry {
  return {
    id: 9,
    action: "account.suspend",
    actor: { id: 3, display_name: "Demo Enforcer" },
    account_id: 42,
    details: {},
    correlation_id: correlationId,
    created_at: "2026-09-30T01:02:03.456789Z",
    ...overrides,
  };
}

function renderAuditPage(items: AuditLogEntry[]): void {
  renderRoutes({
    apiClient: buildApiClient({
      fetchSession: () => Promise.resolve(buildSession("viewer")),
      fetchAuditLogs: () => Promise.resolve({ items }),
    }),
    route: "/audit",
  });
}

async function findDataRows(): Promise<HTMLElement[]> {
  await screen.findByRole("table");
  return screen.getAllByRole("row").slice(1);
}

describe("AuditPage", () => {
  it("shows each entry with its action, its account and its reason", async () => {
    renderAuditPage([
      buildEntry({ details: { reason: "Twelve accounts share this fingerprint." } }),
    ]);

    const [row] = await findDataRows();
    if (row === undefined) {
      throw new Error("The table has no rows.");
    }
    expect(within(row).getByText("Suspended an account")).toBeTruthy();
    expect(within(row).getByText("Demo Enforcer")).toBeTruthy();
    expect(within(row).getByText("Twelve accounts share this fingerprint.")).toBeTruthy();
    expect(within(row).getByRole("link", { name: "Account 42" }).getAttribute("href")).toBe(
      "/accounts/42",
    );
    expect(within(row).getByTitle("2026-09-30 01:02:03 UTC")).toBeTruthy();
  });

  it("names the fields of a reveal when details.fields is a list of text", async () => {
    renderAuditPage([
      buildEntry({
        action: "pii.reveal",
        details: {
          reason: "Checking a report against this signup.",
          fields: ["email", "signup_ip", "device_fingerprint", "user_agent"],
        },
      }),
    ]);

    const [row] = await findDataRows();
    if (row === undefined) {
      throw new Error("The table has no rows.");
    }
    expect(within(row).getByText("Revealed personal data")).toBeTruthy();
    expect(within(row).getByText("Checking a report against this signup.")).toBeTruthy();
    expect(
      within(row).getByText(
        "Fields revealed: Email, Signup IP address, Device fingerprint, User agent",
      ),
    ).toBeTruthy();
  });

  it("shows a mode change, which has no account", async () => {
    renderAuditPage([
      buildEntry({
        action: "mode.change",
        account_id: null,
        details: { reason: "Signup burst from one network in the last hour." },
      }),
    ]);

    const [row] = await findDataRows();
    if (row === undefined) {
      throw new Error("The table has no rows.");
    }
    expect(within(row).getByText("Changed the operational mode")).toBeTruthy();
    expect(
      within(row).getByText("Signup burst from one network in the last hour."),
    ).toBeTruthy();
    expect(within(row).queryByRole("link")).toBeNull();
  });

  it("leaves out every value of details that does not have the expected shape", async () => {
    renderAuditPage([
      buildEntry({
        action: "pii.reveal",
        details: {
          reason: 12,
          fields: ["email", 7],
          email: "mallory@example.com",
          nested: { ip: "192.0.2.44" },
        },
      }),
    ]);

    const [row] = await findDataRows();
    if (row === undefined) {
      throw new Error("The table has no rows.");
    }
    expect(within(row).getByText("Revealed personal data")).toBeTruthy();
    expect(row.textContent).not.toContain("12");
    expect(row.textContent).not.toContain("Fields revealed");
    expect(row.textContent).not.toContain("mallory@example.com");
    expect(row.textContent).not.toContain("192.0.2.44");
  });

  it("shows the empty state for an empty trail", async () => {
    renderAuditPage([]);

    expect(await screen.findByText("The audit trail is empty")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows the forbidden state on a 403", async () => {
    renderRoutes({
      apiClient: buildApiClient({
        fetchSession: () => Promise.resolve(buildSession("viewer")),
        fetchAuditLogs: () =>
          Promise.reject(buildApiError(403, "forbidden", "Your group may not read this.")),
      }),
      route: "/audit",
    });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Your group does not have access");
    expect(alert.textContent).toContain(correlationId);
  });
});
