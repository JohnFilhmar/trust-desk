import { describe, expect, it, jest } from "@jest/globals";
import { enforcement_result_schema } from "@trust-desk/shared";
import enforcementResultFixture from "@trust-desk/shared/fixtures/enforcement_result.json";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { SuspendDialog } from "@/components/SuspendDialog";
import type { SuspendDialogProps } from "@/components/SuspendDialog";
import type { ApiClient } from "@/lib/api/apiClient";
import { buildApiError, correlationId } from "@/testUtils/fixtures";
import { buildApiClient, renderWithProviders } from "@/testUtils/renderWithProviders";

const enforcementResult = enforcement_result_schema.parse(enforcementResultFixture);
const typedReason = "Twelve accounts share this fingerprint.";

function renderDialog(suspendAccount: ApiClient["suspendAccount"]): {
  onOpenChange: jest.Mock<SuspendDialogProps["onOpenChange"]>;
  onSuspended: jest.Mock<SuspendDialogProps["onSuspended"]>;
} {
  const onOpenChange = jest.fn<SuspendDialogProps["onOpenChange"]>();
  const onSuspended = jest.fn<SuspendDialogProps["onSuspended"]>();
  renderWithProviders(
    <SuspendDialog accountId={42} isOpen onOpenChange={onOpenChange} onSuspended={onSuspended} />,
    {
      apiClient: buildApiClient({
        // The dialog never reads the session, so the session stays pending.
        fetchSession: () => new Promise(() => undefined),
        suspendAccount,
      }),
    },
  );
  return { onOpenChange, onSuspended };
}

function getReasonField(): HTMLTextAreaElement {
  const field = screen.getByLabelText("Reason");
  if (!(field instanceof HTMLTextAreaElement)) {
    throw new Error("The reason field is not a textarea.");
  }
  return field;
}

function getSubmitButton(): HTMLElement {
  return screen.getByRole("button", { name: "Confirm suspension" });
}

describe("SuspendDialog", () => {
  it("keeps the submit button disabled for 9 characters and enables it for 10", async () => {
    const user = userEvent.setup();
    renderDialog(jest.fn<ApiClient["suspendAccount"]>());

    expect(getSubmitButton().hasAttribute("disabled")).toBe(true);

    await user.type(getReasonField(), "123456789");
    expect(getSubmitButton().hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/^9 of 500 characters/)).toBeTruthy();

    await user.type(getReasonField(), "0");
    expect(getSubmitButton().hasAttribute("disabled")).toBe(false);
    expect(screen.getByText(/^10 of 500 characters/)).toBeTruthy();
  });

  it("does not enable the submit button for a reason of only spaces", async () => {
    const user = userEvent.setup();
    renderDialog(jest.fn<ApiClient["suspendAccount"]>());

    await user.type(getReasonField(), "            ");

    expect(getReasonField().value).toHaveLength(12);
    expect(getSubmitButton().hasAttribute("disabled")).toBe(true);
  });

  it("does not count the spaces around a short reason", async () => {
    const user = userEvent.setup();
    renderDialog(jest.fn<ApiClient["suspendAccount"]>());

    await user.type(getReasonField(), "   too short   ");

    expect(getSubmitButton().hasAttribute("disabled")).toBe(true);
  });

  it("disables the submit button past 500 characters", async () => {
    const user = userEvent.setup();
    renderDialog(jest.fn<ApiClient["suspendAccount"]>());

    await user.click(getReasonField());
    await user.paste("a".repeat(500));
    expect(getSubmitButton().hasAttribute("disabled")).toBe(false);

    await user.paste("a");
    expect(getSubmitButton().hasAttribute("disabled")).toBe(true);
  });

  it("stays open with the typed text and shows the correlation id when the request fails", async () => {
    const user = userEvent.setup();
    const suspendAccount = jest
      .fn<ApiClient["suspendAccount"]>()
      .mockRejectedValue(
        buildApiError(503, "core_api_unavailable", "The enforcement service is not available."),
      );
    const { onOpenChange, onSuspended } = renderDialog(suspendAccount);

    await user.type(getReasonField(), typedReason);
    await user.click(getSubmitButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The enforcement service is not available.");
    expect(alert.textContent).toContain(correlationId);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(getReasonField().value).toBe(typedReason);
    expect(onSuspended).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("says the account was already suspended on a 409", async () => {
    const user = userEvent.setup();
    const suspendAccount = jest
      .fn<ApiClient["suspendAccount"]>()
      .mockRejectedValue(
        buildApiError(409, "already_suspended", "The account is already suspended."),
      );
    renderDialog(suspendAccount);

    await user.type(getReasonField(), typedReason);
    await user.click(getSubmitButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("This account was already suspended");
    expect(alert.textContent).toContain(correlationId);
    expect(getReasonField().value).toBe(typedReason);
  });

  it("sends the trimmed reason and runs the success callback", async () => {
    const user = userEvent.setup();
    const suspendAccount = jest
      .fn<ApiClient["suspendAccount"]>()
      .mockResolvedValue(enforcementResult);
    const { onSuspended } = renderDialog(suspendAccount);

    await user.type(getReasonField(), `  ${typedReason}  `);
    await user.click(getSubmitButton());

    await waitFor(() => {
      expect(onSuspended).toHaveBeenCalledWith(enforcementResult);
    });
    expect(suspendAccount).toHaveBeenCalledTimes(1);
    expect(suspendAccount).toHaveBeenCalledWith(42, { reason: typedReason });
  });

  it("says the request is running and blocks a second one", async () => {
    const user = userEvent.setup();
    const suspendAccount = jest
      .fn<ApiClient["suspendAccount"]>()
      .mockReturnValue(new Promise(() => undefined));
    renderDialog(suspendAccount);

    await user.type(getReasonField(), typedReason);
    await user.click(getSubmitButton());

    const runningButton = await screen.findByRole("button", { name: "Suspending account" });
    expect(runningButton.hasAttribute("disabled")).toBe(true);
    expect(suspendAccount).toHaveBeenCalledTimes(1);
  });

  it("has no accessibility violations axe can detect", async () => {
    renderDialog(jest.fn<ApiClient["suspendAccount"]>());
    await screen.findByRole("dialog");

    const results = await axe(document.body);

    expect(results.violations).toEqual([]);
  });
});
