import { describe, expect, it, jest } from "@jest/globals";
import type { OperationalMode, StaffGroup } from "@trust-desk/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ApiClient } from "@/lib/api/apiClient";
import {
  buildAccountSummary,
  buildApiError,
  buildOperationalMode,
  buildSession,
  correlationId,
} from "@/testUtils/fixtures";
import { buildApiClient, renderRoutes } from "@/testUtils/renderWithProviders";

const typedReason = "Signup burst from one network in the last hour.";
const elevated = buildOperationalMode({
  mode: "elevated",
  reason: typedReason,
  review_threshold: 40,
});
const lockdown = buildOperationalMode({
  mode: "lockdown",
  reason: "Coordinated abuse wave in progress.",
  review_threshold: 40,
  unsuspend_allowed: false,
});

function renderShell(
  group: StaffGroup,
  mode: OperationalMode,
  answers: Partial<ApiClient> = {},
): void {
  renderRoutes({
    apiClient: buildApiClient({
      fetchSession: () => Promise.resolve(buildSession(group)),
      fetchOperationalMode: () => Promise.resolve(mode),
      searchAccounts: () =>
        Promise.resolve({ items: [buildAccountSummary()], next_cursor: null }),
      ...answers,
    }),
    route: "/accounts",
  });
}

function queryBanner(): HTMLElement | null {
  return screen.queryByRole("status", { name: "Operational mode" });
}

describe("ModeBanner", () => {
  it("is absent in normal mode, where the top bar shows a small indicator", async () => {
    renderShell("viewer", buildOperationalMode());

    expect(await screen.findByText("Mode: Normal")).toBeTruthy();
    expect(queryBanner()).toBeNull();
  });

  it("shows the mode, the reason, who set it and when in elevated mode", async () => {
    renderShell("viewer", elevated);

    const banner = await screen.findByRole("status", { name: "Operational mode" });
    expect(banner.textContent).toContain("Elevated mode.");
    expect(banner.textContent).toContain(typedReason);
    expect(banner.textContent).toContain("Set by Demo Enforcer");
    expect(within(banner).getByTitle("2026-09-30 01:02:03 UTC")).toBeTruthy();
    expect(banner.textContent).toContain("risk score of 40");
    expect(banner.textContent).not.toContain("Nobody can lift a suspension");
    expect(screen.queryByText(/^Mode:/)).toBeNull();
  });

  it("shows the reason and the unsuspend rule in lockdown mode", async () => {
    renderShell("analyst", lockdown);

    const banner = await screen.findByRole("status", { name: "Operational mode" });
    expect(banner.textContent).toContain("Lockdown mode.");
    expect(banner.textContent).toContain("Coordinated abuse wave in progress.");
    expect(banner.textContent).toContain("Nobody can lift a suspension.");
  });

  it("says the mode is unknown when it cannot be read", async () => {
    renderShell("viewer", buildOperationalMode(), {
      fetchOperationalMode: () =>
        Promise.reject(buildApiError(400, "invalid_request", "The request was not valid.")),
    });

    expect(await screen.findByText("Mode unknown")).toBeTruthy();
    expect(queryBanner()).toBeNull();
  });
});

describe("ModeChangeDialog", () => {
  it.each<StaffGroup>(["viewer", "analyst"])(
    "shows no Change mode control to a %s",
    async (group) => {
      renderShell(group, buildOperationalMode());

      expect(await screen.findByText("Mode: Normal")).toBeTruthy();
      expect(await screen.findByRole("table")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Change mode" })).toBeNull();
    },
  );

  it("offers three labelled modes to an enforcer, with the one in force disabled", async () => {
    const user = userEvent.setup();
    renderShell("enforcer", buildOperationalMode());
    await screen.findByText("Mode: Normal");

    await user.click(screen.getByRole("button", { name: "Change mode" }));

    const group = screen.getByRole("group", { name: "Mode" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(within(group).getByRole("radio", { name: /^Normal, in force now/ })).toBe(radios[0]);
    expect(radios[0]?.hasAttribute("disabled")).toBe(true);
    expect(within(group).getByRole("radio", { name: /^Elevated/ }).hasAttribute("disabled")).toBe(
      false,
    );
    expect(within(group).getByRole("radio", { name: /^Lockdown.*nobody can lift/ })).toBeTruthy();
  });

  it("needs both a mode and a reason before it submits", async () => {
    const user = userEvent.setup();
    renderShell("enforcer", buildOperationalMode());
    await screen.findByText("Mode: Normal");
    await user.click(screen.getByRole("button", { name: "Change mode" }));
    const dialog = screen.getByRole("dialog");
    const submit = within(dialog).getByRole("button", { name: "Change mode" });

    await user.type(within(dialog).getByLabelText("Reason"), typedReason);
    expect(submit.hasAttribute("disabled")).toBe(true);

    await user.click(within(dialog).getByRole("radio", { name: /^Elevated/ }));
    expect(submit.hasAttribute("disabled")).toBe(false);
  });

  it("changes the mode, then shows the banner and refreshes the accounts", async () => {
    const user = userEvent.setup();
    const changeOperationalMode = jest
      .fn<ApiClient["changeOperationalMode"]>()
      .mockResolvedValue(elevated);
    const searchAccounts = jest
      .fn<ApiClient["searchAccounts"]>()
      .mockResolvedValue({ items: [buildAccountSummary()], next_cursor: null });
    renderShell("enforcer", buildOperationalMode(), { changeOperationalMode, searchAccounts });
    await screen.findByText("Mode: Normal");
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: "Change mode" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: /^Elevated/ }));
    await user.type(within(dialog).getByLabelText("Reason"), typedReason);
    await user.click(within(dialog).getByRole("button", { name: "Change mode" }));

    const banner = await screen.findByRole("status", { name: "Operational mode" });
    expect(banner.textContent).toContain("Elevated mode.");
    expect(changeOperationalMode).toHaveBeenCalledWith({ mode: "elevated", reason: typedReason });
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => {
      expect(searchAccounts).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Change mode" }));
    });
  });

  it("keeps the dialog open and shows the correlation id when the change fails", async () => {
    const user = userEvent.setup();
    const changeOperationalMode = jest
      .fn<ApiClient["changeOperationalMode"]>()
      .mockRejectedValue(buildApiError(409, "mode_unchanged", "The mode is already elevated."));
    renderShell("enforcer", buildOperationalMode(), { changeOperationalMode });
    await screen.findByText("Mode: Normal");

    await user.click(screen.getByRole("button", { name: "Change mode" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: /^Elevated/ }));
    await user.type(within(dialog).getByLabelText("Reason"), typedReason);
    await user.click(within(dialog).getByRole("button", { name: "Change mode" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("This mode is already in force");
    expect(alert.textContent).toContain(correlationId);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(within(dialog).getByLabelText("Reason").textContent).toBe(typedReason);
  });
});
