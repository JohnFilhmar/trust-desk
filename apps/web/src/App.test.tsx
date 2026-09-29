import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { buildApiError } from "@/testUtils/fixtures";
import { buildApiClient } from "@/testUtils/renderWithProviders";

// App builds its browser router when the module loads, and the router reads
// the address at that moment. The address is set first and App is imported
// after. The test stays on /login because jsdom has no `Request`, which the
// browser router needs to move to another page. `routes.test.tsx` covers the
// moves between pages with a memory router.
async function renderApp(): Promise<void> {
  window.history.pushState({}, "", "/login");
  const { App } = await import("@/App");
  const apiClient = buildApiClient({
    fetchSession: () =>
      Promise.reject(buildApiError(401, "unauthenticated", "Sign in to continue.")),
  });
  render(<App apiClient={apiClient} />);
  await screen.findByRole("button", { name: "Sign in" });
}

describe("App", () => {
  it("shows the login page with the product name in the page heading", async () => {
    await renderApp();

    expect(
      screen.getByRole("heading", { level: 1, name: "Sign in to Trust Desk" }),
    ).toBeTruthy();
    expect(screen.getByText(/Demo with synthetic data/)).toBeTruthy();
  });

  it("has no accessibility violations axe can detect", async () => {
    await renderApp();

    const results = await axe(document.body);

    expect(results.violations).toEqual([]);
  });
});
