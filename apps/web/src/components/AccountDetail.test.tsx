import { describe, expect, it, jest } from "@jest/globals";
import type { StaffGroup } from "@trust-desk/shared";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import type { ApiClient } from "@/lib/api/apiClient";
import {
  buildAccount,
  buildAccountSummary,
  buildApiError,
  buildRevealedAccount,
  buildSession,
  correlationId,
} from "@/testUtils/fixtures";
import { AppRoutes, buildApiClient, renderWithProviders } from "@/testUtils/renderWithProviders";

const typedReason = "Checking whether this signup matches the abuse report.";
const masked = buildAccount();
const unmasked = buildRevealedAccount();

let queryClient: QueryClient | null = null;
let address = "";

function CacheProbe(): null {
  const location = useLocation();
  queryClient = useQueryClient();
  address = `${location.pathname}${location.search}${location.hash}`;
  return null;
}

function readEverythingCached(): string {
  if (queryClient === null) {
    throw new Error("The probe was not rendered.");
  }
  return JSON.stringify([
    queryClient
      .getQueryCache()
      .getAll()
      .map((query) => [query.queryKey, query.state.data]),
    queryClient
      .getMutationCache()
      .getAll()
      .map((mutation) => [mutation.state.variables, mutation.state.data]),
  ]);
}

function renderAccount(group: StaffGroup, revealAccountPii: ApiClient["revealAccountPii"]): void {
  renderWithProviders(
    <>
      <AppRoutes />
      <CacheProbe />
    </>,
    {
      apiClient: buildApiClient({
        fetchSession: () => Promise.resolve(buildSession(group)),
        fetchAccount: () => Promise.resolve({ account: masked, enforcement_actions: [] }),
        searchAccounts: () =>
          Promise.resolve({
            items: [buildAccountSummary({ id: 42, email: masked.email })],
            next_cursor: null,
          }),
        revealAccountPii,
      }),
      route: "/accounts/42",
    },
  );
}

function revealing(): jest.Mock<ApiClient["revealAccountPii"]> {
  return jest
    .fn<ApiClient["revealAccountPii"]>()
    .mockResolvedValue({ account: unmasked, audit_log_id: 7 });
}

async function submitReveal(user: UserEvent): Promise<void> {
  await user.click(await screen.findByRole("button", { name: "Reveal PII" }));
  await user.type(screen.getByLabelText("Reason"), typedReason);
  await user.click(screen.getByRole("button", { name: "Reveal" }));
}

describe("AccountDetail, reveal", () => {
  it("shows no reveal button to a viewer, and says why", async () => {
    renderAccount("viewer", revealing());

    expect(await screen.findByText(/Your group, Viewer, cannot reveal personal data/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reveal PII" })).toBeNull();
    expect(screen.getByText(masked.email)).toBeTruthy();
  });

  it("keeps submit disabled for a short reason", async () => {
    const user = userEvent.setup();
    const revealAccountPii = revealing();
    renderAccount("analyst", revealAccountPii);

    await user.click(await screen.findByRole("button", { name: "Reveal PII" }));
    await user.type(screen.getByLabelText("Reason"), "too short");

    expect(screen.getByRole("button", { name: "Reveal" }).hasAttribute("disabled")).toBe(true);
    expect(revealAccountPii).not.toHaveBeenCalled();
  });

  it("shows the unmasked values, a Revealed marker and the audit row on success", async () => {
    const user = userEvent.setup();
    const revealAccountPii = revealing();
    renderAccount("analyst", revealAccountPii);

    await submitReveal(user);

    expect(await screen.findByText(unmasked.email)).toBeTruthy();
    expect(screen.getByText(unmasked.signup_context.ip)).toBeTruthy();
    expect(screen.getByText(unmasked.signup_context.device_fingerprint)).toBeTruthy();
    expect(screen.getByText(unmasked.signup_context.user_agent)).toBeTruthy();
    expect(screen.queryByText(masked.email)).toBeNull();
    const marker = screen.getByText("Revealed").closest("p");
    expect(marker?.textContent).toContain("Audit row 7");
    expect(document.activeElement).toBe(marker);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Reveal PII" })).toBeNull();
    expect(screen.queryByText(/The server masks the personal data/)).toBeNull();
    expect(revealAccountPii).toHaveBeenCalledWith(42, { reason: typedReason });
  });

  it("keeps revealed values out of the query cache, the address and browser storage", async () => {
    const user = userEvent.setup();
    renderAccount("analyst", revealing());

    await submitReveal(user);
    await screen.findByText(unmasked.email);

    const cached = readEverythingCached();
    expect(cached).toContain(masked.email);
    expect(cached).not.toContain(unmasked.email);
    expect(cached).not.toContain(unmasked.signup_context.ip);
    expect(cached).not.toContain(unmasked.signup_context.device_fingerprint);
    expect(address).toBe("/accounts/42");
    expect(window.localStorage).toHaveLength(0);
    expect(window.sessionStorage).toHaveLength(0);
  });

  it("shows masked values again after the analyst leaves the page and comes back", async () => {
    const user = userEvent.setup();
    renderAccount("analyst", revealing());
    await submitReveal(user);
    await screen.findByText(unmasked.email);

    await user.click(screen.getByRole("link", { name: "Back to accounts" }));
    await user.click(await screen.findByRole("link", { name: masked.email }));

    expect(await screen.findByRole("heading", { level: 1, name: "Account 42" })).toBeTruthy();
    expect(screen.getAllByText(masked.email).length).toBeGreaterThan(0);
    expect(screen.queryByText(unmasked.email)).toBeNull();
    expect(screen.queryByText("Revealed")).toBeNull();
    expect(screen.getByRole("button", { name: "Reveal PII" })).toBeTruthy();
  });

  it("reveals nothing and shows the correlation id on a 503", async () => {
    const user = userEvent.setup();
    const revealAccountPii = jest
      .fn<ApiClient["revealAccountPii"]>()
      .mockRejectedValue(
        buildApiError(503, "core_api_unavailable", "The audit service is not available."),
      );
    renderAccount("analyst", revealAccountPii);

    await submitReveal(user);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Nothing was revealed");
    expect(alert.textContent).toContain("The audit service is not available.");
    expect(alert.textContent).toContain(correlationId);
    expect(screen.getByLabelText("Reason").textContent).toBe(typedReason);
    expect(screen.queryByText(unmasked.email)).toBeNull();
    expect(screen.queryByText("Revealed")).toBeNull();
    expect(screen.getByText(masked.email)).toBeTruthy();
  });
});
