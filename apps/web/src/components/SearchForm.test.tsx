import { describe, expect, it, jest } from "@jest/globals";
import type { StaffGroup } from "@trust-desk/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router-dom";
import type { ApiClient } from "@/lib/api/apiClient";
import {
  buildAccountSummary,
  buildApiError,
  buildSession,
  correlationId,
} from "@/testUtils/fixtures";
import { AppRoutes, buildApiClient, renderWithProviders } from "@/testUtils/renderWithProviders";

// The form reads and writes the address, and the accounts page turns the
// address into a request. These tests render the page so that they cover
// the whole path from a typed term to the call.

let address = "";

function AddressProbe(): null {
  const location = useLocation();
  address = `${location.pathname}${location.search}`;
  return null;
}

function renderAccountsPage(
  searchAccounts: ApiClient["searchAccounts"],
  route = "/accounts",
  group: StaffGroup = "viewer",
): void {
  renderWithProviders(
    <>
      <AppRoutes />
      <AddressProbe />
    </>,
    {
      apiClient: buildApiClient({
        fetchSession: () => Promise.resolve(buildSession(group)),
        searchAccounts,
      }),
      route,
    },
  );
}

function answeringOneRow(): jest.Mock<ApiClient["searchAccounts"]> {
  return jest
    .fn<ApiClient["searchAccounts"]>()
    .mockResolvedValue({ items: [buildAccountSummary()], next_cursor: null });
}

describe("SearchForm", () => {
  it("shows no PII fields to a viewer, and says the group filters by status only", async () => {
    renderAccountsPage(answeringOneRow());

    expect(await screen.findByText(/Your group, Viewer, can filter by status only/)).toBeTruthy();
    expect(screen.queryByRole("search")).toBeNull();
    expect(screen.queryByLabelText(/^Email/)).toBeNull();
    expect(screen.queryByLabelText(/^Signup IP address/)).toBeNull();
    expect(screen.queryByLabelText(/^Device fingerprint/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });

  it("shows the three PII fields to an analyst, with the note on masked results", async () => {
    renderAccountsPage(answeringOneRow(), "/accounts", "analyst");

    const form = await screen.findByRole("search", { name: "Search accounts" });
    expect(within(form).getByLabelText(/^Email/)).toBeTruthy();
    expect(within(form).getByLabelText(/^Signup IP address/)).toBeTruthy();
    expect(within(form).getByLabelText(/^Device fingerprint/)).toBeTruthy();
    expect(within(form).getByText(/Results match the full value/)).toBeTruthy();
    expect(screen.queryByText(/can filter by status only/)).toBeNull();
  });

  it("sends nothing and shows a message for a 1-character term", async () => {
    const user = userEvent.setup();
    const searchAccounts = answeringOneRow();
    renderAccountsPage(searchAccounts, "/accounts", "analyst");
    await screen.findByRole("table");

    await user.type(screen.getByLabelText(/^Email/), "a");
    await user.click(screen.getByRole("button", { name: "Search" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("A search term needs 2 to 100 characters.");
    expect(address).toBe("/accounts");
    expect(searchAccounts).toHaveBeenCalledTimes(1);
  });

  it("puts valid terms in the URL, keeps the status, and calls the client with them", async () => {
    const user = userEvent.setup();
    const searchAccounts = answeringOneRow();
    renderAccountsPage(searchAccounts, "/accounts?status=active", "analyst");
    await screen.findByRole("table");

    await user.type(screen.getByLabelText(/^Email/), "  mallory  ");
    await user.type(screen.getByLabelText(/^Signup IP address/), "192.0.2.44");
    await user.type(screen.getByLabelText(/^Device fingerprint/), "fp_7c1d09a1");
    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(searchAccounts).toHaveBeenLastCalledWith({
        status: "active",
        email: "mallory",
        ip: "192.0.2.44",
        fingerprint: "fp_7c1d09a1",
        cursor: undefined,
      });
    });
    expect(address).toBe(
      "/accounts?status=active&email=mallory&ip=192.0.2.44&fingerprint=fp_7c1d09a1",
    );
  });

  it("searches with the terms in a shared address and fills the form from it", async () => {
    const searchAccounts = answeringOneRow();
    renderAccountsPage(searchAccounts, "/accounts?ip=192.0.2.44", "enforcer");

    await screen.findByRole("table");

    expect(searchAccounts).toHaveBeenCalledWith({
      status: undefined,
      ip: "192.0.2.44",
      cursor: undefined,
    });
    expect(screen.getByDisplayValue("192.0.2.44")).toBe(
      screen.getByLabelText(/^Signup IP address/),
    );
  });

  it("clears the search and keeps the status", async () => {
    const user = userEvent.setup();
    const searchAccounts = answeringOneRow();
    renderAccountsPage(searchAccounts, "/accounts?status=suspended&email=mallory", "analyst");
    await screen.findByRole("table");

    await user.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() => {
      expect(address).toBe("/accounts?status=suspended");
    });
    expect(screen.queryByDisplayValue("mallory")).toBeNull();
    await waitFor(() => {
      expect(searchAccounts).toHaveBeenLastCalledWith({
        status: "suspended",
        cursor: undefined,
      });
    });
  });

  it("keeps the search terms when the status filter changes", async () => {
    renderAccountsPage(answeringOneRow(), "/accounts?email=mallory", "analyst");
    await screen.findByRole("table");

    const filter = screen.getByRole("navigation", { name: "Filter by status" });
    const suspendedLink = within(filter).getByRole("link", { name: "Suspended" });
    expect(suspendedLink.getAttribute("href")).toBe("/accounts?email=mallory&status=suspended");
  });

  it("sends nothing for a term in the address that the contract refuses", async () => {
    const searchAccounts = answeringOneRow();
    renderAccountsPage(searchAccounts, "/accounts?email=a", "analyst");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The search in the address is not valid");
    expect(searchAccounts).not.toHaveBeenCalled();
    expect(screen.queryByText("Loading accounts")).toBeNull();
  });

  it("shows the forbidden state, and a way out, when a viewer opens a PII search", async () => {
    const searchAccounts = jest
      .fn<ApiClient["searchAccounts"]>()
      .mockRejectedValue(buildApiError(403, "forbidden", "Your group may not search by PII."));
    renderAccountsPage(searchAccounts, "/accounts?email=mallory");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Your group does not have access");
    expect(alert.textContent).toContain(correlationId);
    expect(screen.getByRole("button", { name: "Clear" })).toBeTruthy();
  });
});
