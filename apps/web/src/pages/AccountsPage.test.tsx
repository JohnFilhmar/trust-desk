import { describe, expect, it, jest } from "@jest/globals";
import type { AccountSummary } from "@trust-desk/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import type { ApiClient } from "@/lib/api/apiClient";
import { buildApiError, buildSession, correlationId } from "@/testUtils/fixtures";
import { buildApiClient, renderRoutes } from "@/testUtils/renderWithProviders";

const activeAccount: AccountSummary = {
  id: 1,
  email: "a***@example.com",
  status: "active",
  plan: "free",
  spam_marked_at: null,
  created_at: "2026-09-01T01:02:03.456789Z",
};

const suspendedSpamAccount: AccountSummary = {
  id: 2,
  email: "b***@example.org",
  status: "suspended",
  plan: "pro",
  spam_marked_at: "2026-09-20T10:00:00.000000Z",
  created_at: "2026-09-02T01:02:03.456789Z",
};

function renderAccountsPage(
  searchAccounts: ApiClient["searchAccounts"],
  route = "/accounts",
): void {
  renderRoutes({
    apiClient: buildApiClient({
      fetchSession: () => Promise.resolve(buildSession("viewer")),
      searchAccounts,
    }),
    route,
  });
}

describe("AccountsPage", () => {
  it("renders the rows it is given", async () => {
    const searchAccounts = jest.fn<ApiClient["searchAccounts"]>().mockResolvedValue({
      items: [activeAccount, suspendedSpamAccount],
      next_cursor: null,
    });
    renderAccountsPage(searchAccounts);

    const firstLink = await screen.findByRole("link", { name: "a***@example.com" });
    expect(firstLink.getAttribute("href")).toBe("/accounts/1");

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3);
    const [, firstRow, secondRow] = rows;
    if (firstRow === undefined || secondRow === undefined) {
      throw new Error("The table has fewer rows than the test gave it.");
    }
    expect(within(firstRow).getByText("Active")).toBeTruthy();
    expect(within(firstRow).getByText("free")).toBeTruthy();
    expect(within(firstRow).queryByText("Marked as spam")).toBeNull();
    expect(within(secondRow).getByRole("link", { name: "b***@example.org" })).toBeTruthy();
    expect(within(secondRow).getByText("Suspended")).toBeTruthy();
    expect(within(secondRow).getByText("pro")).toBeTruthy();
    expect(within(secondRow).getByText("Marked as spam")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("shows the empty state for an empty list", async () => {
    const searchAccounts = jest
      .fn<ApiClient["searchAccounts"]>()
      .mockResolvedValue({ items: [], next_cursor: null });
    renderAccountsPage(searchAccounts);

    expect(await screen.findByText("No accounts match this filter")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("asks for the status in the URL and marks that filter as current", async () => {
    const searchAccounts = jest
      .fn<ApiClient["searchAccounts"]>()
      .mockResolvedValue({ items: [suspendedSpamAccount], next_cursor: null });
    renderAccountsPage(searchAccounts, "/accounts?status=suspended");

    await screen.findByRole("table");

    expect(searchAccounts).toHaveBeenCalledWith({ status: "suspended", cursor: undefined });
    const filter = screen.getByRole("navigation", { name: "Filter by status" });
    const current = within(filter).getByRole("link", { current: true });
    expect(current.textContent).toBe("Suspended");
  });

  it("treats a status the contract does not know as no filter", async () => {
    const searchAccounts = jest
      .fn<ApiClient["searchAccounts"]>()
      .mockResolvedValue({ items: [activeAccount], next_cursor: null });
    renderAccountsPage(searchAccounts, "/accounts?status=deleted");

    await screen.findByRole("table");

    expect(searchAccounts).toHaveBeenCalledWith({ status: undefined, cursor: undefined });
  });

  it("loads the next page with the cursor the server sent", async () => {
    const user = userEvent.setup();
    const searchAccounts = jest
      .fn<ApiClient["searchAccounts"]>()
      .mockResolvedValueOnce({ items: [activeAccount], next_cursor: "cursor-2" })
      .mockResolvedValueOnce({ items: [suspendedSpamAccount], next_cursor: null });
    renderAccountsPage(searchAccounts);

    await user.click(await screen.findByRole("button", { name: "Load more" }));

    expect(await screen.findByRole("link", { name: "b***@example.org" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "a***@example.com" })).toBeTruthy();
    expect(searchAccounts).toHaveBeenLastCalledWith({ status: undefined, cursor: "cursor-2" });
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("shows the message and the correlation id when the request fails", async () => {
    const searchAccounts = jest
      .fn<ApiClient["searchAccounts"]>()
      .mockRejectedValue(buildApiError(422, "invalid_request", "The cursor is not valid."));
    renderAccountsPage(searchAccounts);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The cursor is not valid.");
    expect(alert.textContent).toContain(correlationId);
  });

  it("has no accessibility violations axe can detect", async () => {
    const searchAccounts = jest.fn<ApiClient["searchAccounts"]>().mockResolvedValue({
      items: [activeAccount, suspendedSpamAccount],
      next_cursor: "cursor-2",
    });
    renderAccountsPage(searchAccounts);
    await screen.findByRole("table");

    const results = await axe(document.body);

    expect(results.violations).toEqual([]);
  });
});
