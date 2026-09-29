import { describe, expect, it, jest } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { useState } from "react";
import type { ReactElement } from "react";
import { ReasonDialog } from "@/components/ReasonDialog";
import { buildApiError, correlationId, uuidPattern } from "@/testUtils/fixtures";
import { removeRandomUuid, restoreRandomUuid } from "@/testUtils/insecureContext";

type Submit = (reason: string, idempotencyKey: string) => Promise<string>;
type Callback = (value: unknown) => void;

const typedReason = "Twelve accounts share this fingerprint.";

function Harness(props: {
  onSubmit: Submit;
  onSuccess: Callback;
  onFailure: Callback;
  canSubmit?: boolean;
}): ReactElement {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <ReasonDialog
      triggerLabel="Open the dialog"
      title="Suspend account 42"
      description="The reason goes into the audit trail."
      submitLabel="Confirm"
      pendingLabel="Sending"
      failureHeading="The request failed"
      failureHeadingsByCode={{ already_suspended: "This account was already suspended" }}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      {...props}
    />
  );
}

function renderDialog(
  onSubmit: Submit,
  canSubmit?: boolean,
): { onSuccess: jest.Mock<Callback>; onFailure: jest.Mock<Callback> } {
  const onSuccess = jest.fn<Callback>();
  const onFailure = jest.fn<Callback>();
  render(
    <Harness
      onSubmit={onSubmit}
      onSuccess={onSuccess}
      onFailure={onFailure}
      canSubmit={canSubmit}
    />,
  );
  return { onSuccess, onFailure };
}

function getReasonField(): HTMLTextAreaElement {
  const field = screen.getByLabelText("Reason");
  if (!(field instanceof HTMLTextAreaElement)) {
    throw new Error("The reason field is not a textarea.");
  }
  return field;
}

function getSubmitButton(): HTMLElement {
  return screen.getByRole("button", { name: "Confirm" });
}

function failingWith(status: number, code: string, message: string): jest.Mock<Submit> {
  return jest.fn<Submit>().mockRejectedValue(buildApiError(status, code, message));
}

describe("ReasonDialog", () => {
  it("keeps the submit button disabled for 9 characters and enables it for 10", async () => {
    const user = userEvent.setup();
    renderDialog(jest.fn<Submit>());

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
    renderDialog(jest.fn<Submit>());

    await user.type(getReasonField(), "            ");

    expect(getReasonField().value).toHaveLength(12);
    expect(getSubmitButton().hasAttribute("disabled")).toBe(true);
  });

  it("does not count the spaces around a short reason", async () => {
    const user = userEvent.setup();
    renderDialog(jest.fn<Submit>());

    await user.type(getReasonField(), "   too short   ");

    expect(getSubmitButton().hasAttribute("disabled")).toBe(true);
  });

  it("disables the submit button past 500 characters", async () => {
    const user = userEvent.setup();
    renderDialog(jest.fn<Submit>());

    await user.click(getReasonField());
    await user.paste("a".repeat(500));
    expect(getSubmitButton().hasAttribute("disabled")).toBe(false);

    await user.paste("a");
    expect(getSubmitButton().hasAttribute("disabled")).toBe(true);
  });

  it("keeps the submit button disabled while the caller says it cannot submit", async () => {
    const user = userEvent.setup();
    renderDialog(jest.fn<Submit>(), false);

    await user.type(getReasonField(), typedReason);

    expect(getSubmitButton().hasAttribute("disabled")).toBe(true);
  });

  it("stays open with the typed text and shows the correlation id when the request fails", async () => {
    const user = userEvent.setup();
    const onSubmit = failingWith(
      503,
      "core_api_unavailable",
      "The enforcement service is not available.",
    );
    const { onSuccess, onFailure } = renderDialog(onSubmit);

    await user.type(getReasonField(), typedReason);
    await user.click(getSubmitButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The request failed");
    expect(alert.textContent).toContain("The enforcement service is not available.");
    expect(alert.textContent).toContain(correlationId);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(getReasonField().value).toBe(typedReason);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it("uses the heading the caller gave for a known error code", async () => {
    const user = userEvent.setup();
    renderDialog(failingWith(409, "already_suspended", "The account is already suspended."));

    await user.type(getReasonField(), typedReason);
    await user.click(getSubmitButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("This account was already suspended");
    expect(alert.textContent).toContain(correlationId);
    expect(getReasonField().value).toBe(typedReason);
  });

  it("says to reopen the dialog when the server refuses a reused key", async () => {
    const user = userEvent.setup();
    renderDialog(failingWith(422, "idempotency_key_reused", "The key was used before."));

    await user.type(getReasonField(), typedReason);
    await user.click(getSubmitButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("This dialog already sent a different reason");
    expect(alert.textContent).toContain("Close the dialog and open it again");
    expect(alert.textContent).toContain(correlationId);
  });

  it("sends the trimmed reason and runs the success callback", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn<Submit>().mockResolvedValue("done");
    const { onSuccess } = renderDialog(onSubmit);

    await user.type(getReasonField(), `  ${typedReason}  `);
    await user.click(getSubmitButton());

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("done");
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toBe(typedReason);
  });

  it("says the request is running and blocks a second one", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn<Submit>().mockReturnValue(new Promise(() => undefined));
    renderDialog(onSubmit);

    await user.type(getReasonField(), typedReason);
    await user.click(getSubmitButton());

    const runningButton = await screen.findByRole("button", { name: "Sending" });
    expect(runningButton.hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Cancel" }).hasAttribute("disabled")).toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("sends one key for every submit while open, and a new key once reopened", async () => {
    const user = userEvent.setup();
    const onSubmit = failingWith(503, "core_api_unavailable", "Not available.");
    renderDialog(onSubmit);

    await user.type(getReasonField(), typedReason);
    await user.click(getSubmitButton());
    await screen.findByRole("alert");
    await user.click(getSubmitButton());
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(2);
    });
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Open the dialog" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(getReasonField().value).toBe(typedReason);
    await user.click(getSubmitButton());
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(3);
    });

    const keys = onSubmit.mock.calls.map(([, idempotencyKey]) => idempotencyKey);
    expect(keys[0]).toMatch(uuidPattern);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).toMatch(uuidPattern);
    expect(keys[2]).not.toBe(keys[0]);
  });

  // Bug 002. The key must exist on a plain HTTP origin too.
  it("sends a valid key without crypto.randomUUID", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn<Submit>().mockResolvedValue("done");
    removeRandomUuid();
    try {
      renderDialog(onSubmit);
      await user.type(getReasonField(), typedReason);
      await user.click(getSubmitButton());
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });
    } finally {
      restoreRandomUuid();
    }

    expect(onSubmit.mock.calls[0]?.[1]).toMatch(uuidPattern);
  });

  it("has no accessibility violations axe can detect", async () => {
    renderDialog(jest.fn<Submit>());
    await screen.findByRole("dialog");

    const results = await axe(document.body);

    expect(results.violations).toEqual([]);
  });
});
