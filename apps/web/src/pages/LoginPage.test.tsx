import { describe, expect, it, jest } from "@jest/globals";
import { demo_password } from "@trust-desk/shared";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { Route, Routes } from "react-router-dom";
import type { ApiClient } from "@/lib/api/apiClient";
import { LoginPage } from "@/pages/LoginPage";
import { buildApiError, buildSession, correlationId } from "@/testUtils/fixtures";
import { buildApiClient, renderWithProviders } from "@/testUtils/renderWithProviders";

function signedOut(): Promise<never> {
  return Promise.reject(buildApiError(401, "unauthenticated", "Sign in to continue."));
}

function renderLoginPage(login: ApiClient["login"], returnPath?: string): void {
  renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accounts" element={<p>Accounts page</p>} />
      <Route path="/audit" element={<p>Audit page</p>} />
    </Routes>,
    {
      apiClient: buildApiClient({ fetchSession: signedOut, login }),
      route: {
        pathname: "/login",
        state: returnPath === undefined ? null : { returnPath },
      },
    },
  );
}

function findDemoButton(displayName: string): Promise<HTMLElement> {
  return screen.findByRole("button", { name: `Sign in as ${displayName}` });
}

describe("LoginPage", () => {
  it("signs in with the demo account's email and the demo password", async () => {
    const user = userEvent.setup();
    const login = jest.fn<ApiClient["login"]>().mockResolvedValue(buildSession("enforcer"));
    renderLoginPage(login);

    await user.click(await findDemoButton("Demo Enforcer"));

    expect(await screen.findByText("Accounts page")).toBeTruthy();
    expect(login).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith({
      email: "enforcer@example.com",
      password: demo_password,
    });
  });

  it("lists every demo account with its group and what the group may do", async () => {
    renderLoginPage(jest.fn<ApiClient["login"]>());

    expect(await findDemoButton("Demo Viewer")).toBeTruthy();
    expect(await findDemoButton("Demo Analyst")).toBeTruthy();
    expect(await findDemoButton("Demo Enforcer")).toBeTruthy();
    expect(screen.getByText("viewer@example.com").textContent).toContain("Viewer");
    expect(screen.getByText("analyst@example.com").textContent).toContain("Analyst");
    expect(screen.getByText("enforcer@example.com").textContent).toContain("Enforcer");
    expect(screen.getByText(/may suspend an account with a reason/)).toBeTruthy();
  });

  it("shows a generic message on a 401 and never the server's wording", async () => {
    const user = userEvent.setup();
    const login = jest
      .fn<ApiClient["login"]>()
      .mockRejectedValue(buildApiError(401, "invalid_credentials", "No user has this email."));
    renderLoginPage(login);

    await user.type(await screen.findByLabelText("Email"), "nobody@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The email or password is not correct.");
    expect(alert.textContent).toContain(correlationId);
    expect(alert.textContent).not.toContain("No user has this email.");
    expect(login).toHaveBeenCalledWith({
      email: "nobody@example.com",
      password: "wrong-password",
    });
  });

  it("does not call the server when the form is empty", async () => {
    const user = userEvent.setup();
    const login = jest.fn<ApiClient["login"]>();
    renderLoginPage(login);

    await user.click(await screen.findByRole("button", { name: "Sign in" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Enter an email address and a password.");
    expect(login).not.toHaveBeenCalled();
  });

  it("returns the visitor to the page they asked for", async () => {
    const user = userEvent.setup();
    const login = jest.fn<ApiClient["login"]>().mockResolvedValue(buildSession("viewer"));
    renderLoginPage(login, "/audit");

    await user.click(await findDemoButton("Demo Viewer"));

    expect(await screen.findByText("Audit page")).toBeTruthy();
  });

  it("ignores a return path that leaves the app", async () => {
    const user = userEvent.setup();
    const login = jest.fn<ApiClient["login"]>().mockResolvedValue(buildSession("viewer"));
    renderLoginPage(login, "//example.org/audit");

    await user.click(await findDemoButton("Demo Viewer"));

    expect(await screen.findByText("Accounts page")).toBeTruthy();
  });

  it("has no accessibility violations axe can detect", async () => {
    renderLoginPage(jest.fn<ApiClient["login"]>());
    await findDemoButton("Demo Viewer");

    const results = await axe(document.body);

    expect(results.violations).toEqual([]);
  });
});
