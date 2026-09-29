import { describe, expect, it, jest } from "@jest/globals";
import { enforcement_result_schema } from "@trust-desk/shared";
import type { AccountDetailResponse, AccountStatus, StaffGroup } from "@trust-desk/shared";
import enforcementResultFixture from "@trust-desk/shared/fixtures/enforcement_result.json";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import type { ApiClient } from "@/lib/api/apiClient";
import {
  buildAccount,
  buildApiError,
  buildSession,
  correlationId,
  uuidPattern,
} from "@/testUtils/fixtures";
import { buildApiClient, renderRoutes } from "@/testUtils/renderWithProviders";

const enforcementResult = enforcement_result_schema.parse(enforcementResultFixture);
const typedReason = "Twelve accounts share this fingerprint.";

function renderAccountPage(
  group: StaffGroup,
  fetchAccount: ApiClient["fetchAccount"],
  route = "/accounts/42",
  suspendAccount?: ApiClient["suspendAccount"],
): void {
  renderRoutes({
    apiClient: buildApiClient({
      fetchSession: () => Promise.resolve(buildSession(group)),
      fetchAccount,
      ...(suspendAccount === undefined ? {} : { suspendAccount }),
    }),
    route,
  });
}

function detailWith(status: AccountStatus): AccountDetailResponse {
  return {
    account: buildAccount({ status }),
    enforcement_actions:
      status === "active"
        ? []
        : [
            {
              id: 1,
              account_id: 42,
              staff_user_id: 3,
              action_type: "suspend",
              reason: typedReason,
              correlation_id: correlationId,
              created_at: "2026-09-30T01:02:03.456789Z",
            },
          ],
  };
}

function accountWith(status: AccountStatus): jest.Mock<ApiClient["fetchAccount"]> {
  return jest.fn<ApiClient["fetchAccount"]>().mockResolvedValue(detailWith(status));
}

function activeThenSuspended(): jest.Mock<ApiClient["fetchAccount"]> {
  return jest
    .fn<ApiClient["fetchAccount"]>()
    .mockResolvedValueOnce(detailWith("active"))
    .mockResolvedValue(detailWith("suspended"));
}

async function submitSuspension(): Promise<void> {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Suspend account" }));
  await user.type(screen.getByLabelText("Reason"), typedReason);
  await user.click(screen.getByRole("button", { name: "Confirm suspension" }));
}

function querySuspendButton(): HTMLElement | null {
  return screen.queryByRole("button", { name: "Suspend account" });
}

describe("AccountPage", () => {
  it("shows no Suspend button to a viewer, and says the group cannot enforce", async () => {
    renderAccountPage("viewer", accountWith("active"));

    expect(await screen.findByText(/Your group, Viewer, cannot enforce/)).toBeTruthy();
    expect(querySuspendButton()).toBeNull();
  });

  it("shows no Suspend button to an analyst, and says the group cannot enforce", async () => {
    renderAccountPage("analyst", accountWith("active"));

    expect(await screen.findByText(/Your group, Analyst, cannot enforce/)).toBeTruthy();
    expect(querySuspendButton()).toBeNull();
  });

  it("shows the Suspend button to an enforcer on an active account", async () => {
    renderAccountPage("enforcer", accountWith("active"));

    expect(await screen.findByRole("button", { name: "Suspend account" })).toBeTruthy();
    expect(screen.queryByText(/cannot enforce/)).toBeNull();
  });

  it("shows no Suspend button to an enforcer on a suspended account", async () => {
    renderAccountPage("enforcer", accountWith("suspended"));

    expect(await screen.findByRole("button", { name: "Unsuspend account" })).toBeTruthy();
    expect(querySuspendButton()).toBeNull();
  });

  it("shows the account as it arrives, with its signup context and its actions", async () => {
    const fetchAccount = accountWith("suspended");
    renderAccountPage("viewer", fetchAccount);

    expect(await screen.findByRole("heading", { level: 1, name: "Account 42" })).toBeTruthy();
    expect(fetchAccount).toHaveBeenCalledWith(42);
    expect(screen.getByText("m***@example.com")).toBeTruthy();
    expect(screen.getByText("192.0.2.***")).toBeTruthy();
    expect(screen.getByText("fp_***9a1")).toBeTruthy();
    expect(screen.getByText("Twelve accounts share this fingerprint.")).toBeTruthy();
    const created = screen.getByTitle("2026-09-01 01:02:03 UTC");
    expect(created.getAttribute("datetime")).toBe("2026-09-01T01:02:03.456789Z");
  });

  it("shows the message and the correlation id when the account is not found", async () => {
    const fetchAccount = jest
      .fn<ApiClient["fetchAccount"]>()
      .mockRejectedValue(buildApiError(404, "account_not_found", "No account has this id."));
    renderAccountPage("viewer", fetchAccount);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("No account has this id.");
    expect(alert.textContent).toContain(correlationId);
  });

  it("shows the forbidden state on a 403", async () => {
    const fetchAccount = jest
      .fn<ApiClient["fetchAccount"]>()
      .mockRejectedValue(buildApiError(403, "forbidden", "Your group may not do this."));
    renderAccountPage("viewer", fetchAccount);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Your group does not have access");
    expect(alert.textContent).toContain(correlationId);
  });

  it("shows the not-found page for an id that is not a number, and sends no request", async () => {
    const fetchAccount = jest.fn<ApiClient["fetchAccount"]>();
    renderAccountPage("viewer", fetchAccount, "/accounts/abc");

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeTruthy();
    expect(fetchAccount).not.toHaveBeenCalled();
  });

  it("closes the dialog, confirms and refreshes the account after a suspension", async () => {
    const fetchAccount = activeThenSuspended();
    const suspendAccount = jest
      .fn<ApiClient["suspendAccount"]>()
      .mockResolvedValue(enforcementResult);
    renderAccountPage("enforcer", fetchAccount, "/accounts/42", suspendAccount);

    await submitSuspension();

    const confirmation = await screen.findByText(/^Account suspended\./);
    expect(confirmation.getAttribute("role")).toBe("status");
    expect(document.activeElement).toBe(confirmation);
    expect(confirmation.textContent).toContain("Audit row 1");
    expect(suspendAccount).toHaveBeenCalledWith(
      42,
      { reason: typedReason },
      expect.stringMatching(uuidPattern),
    );
    expect(await screen.findByRole("button", { name: "Unsuspend account" })).toBeTruthy();
    expect(fetchAccount).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(querySuspendButton()).toBeNull();
  });

  it("keeps the dialog open and refreshes the account on a 409", async () => {
    const fetchAccount = activeThenSuspended();
    const suspendAccount = jest
      .fn<ApiClient["suspendAccount"]>()
      .mockRejectedValue(
        buildApiError(409, "already_suspended", "The account is already suspended."),
      );
    renderAccountPage("enforcer", fetchAccount, "/accounts/42", suspendAccount);

    await submitSuspension();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("This account was already suspended");
    expect(alert.textContent).toContain(correlationId);
    await waitFor(() => {
      expect(fetchAccount).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByLabelText("Reason").textContent).toBe(typedReason);
  });

  it("shows the risk panel and the timeline in their own sections", async () => {
    renderAccountPage("analyst", accountWith("active"));

    expect(await screen.findByRole("heading", { level: 2, name: "Risk" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Timeline" })).toBeTruthy();
    expect(await screen.findByRole("meter", { name: "Risk score" })).toBeTruthy();
    expect(await screen.findByText("No events")).toBeTruthy();
  });

  it("has no accessibility violations axe can detect", async () => {
    renderAccountPage("enforcer", accountWith("active"));
    await screen.findByRole("button", { name: "Suspend account" });
    await screen.findByRole("meter", { name: "Risk score" });
    await screen.findByText("No events");

    const results = await axe(document.body);

    expect(results.violations).toEqual([]);
  });
});
