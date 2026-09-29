import { describe, expect, it, jest } from "@jest/globals";
import { enforcement_result_schema } from "@trust-desk/shared";
import type { Account, OperationalMode, StaffGroup } from "@trust-desk/shared";
import enforcementResultFixture from "@trust-desk/shared/fixtures/enforcement_result.json";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnforcementPanel } from "@/components/EnforcementPanel";
import type { ApiClient } from "@/lib/api/apiClient";
import {
  buildAccount,
  buildApiError,
  buildOperationalMode,
  buildSession,
  correlationId,
  uuidPattern,
} from "@/testUtils/fixtures";
import { buildApiClient, renderWithProviders } from "@/testUtils/renderWithProviders";

const enforcementResult = enforcement_result_schema.parse(enforcementResultFixture);
const typedReason = "Twelve accounts share this fingerprint.";
const markedAt = "2026-09-20T10:00:00.000000Z";
const lockdown = buildOperationalMode({
  mode: "lockdown",
  reason: "Coordinated abuse wave in progress.",
  review_threshold: 40,
  unsuspend_allowed: false,
});

function renderPanel(options: {
  group: StaffGroup;
  account: Account;
  mode?: OperationalMode;
  answers?: Partial<ApiClient>;
}): void {
  renderWithProviders(
    <main>
      <EnforcementPanel account={options.account} />
    </main>,
    {
      apiClient: buildApiClient({
        fetchSession: () => Promise.resolve(buildSession(options.group)),
        fetchOperationalMode: () => Promise.resolve(options.mode ?? buildOperationalMode()),
        ...options.answers,
      }),
    },
  );
}

function queryButton(name: string): HTMLElement | null {
  return screen.queryByRole("button", { name });
}

describe("EnforcementPanel", () => {
  it("offers suspend and mark as spam to an enforcer on an active, unmarked account", async () => {
    renderPanel({ group: "enforcer", account: buildAccount() });

    expect(await screen.findByRole("button", { name: "Suspend account" })).toBeTruthy();
    expect(queryButton("Mark as spam")).not.toBeNull();
    expect(queryButton("Unsuspend account")).toBeNull();
  });

  it("offers unsuspend, and not suspend, to an enforcer on a suspended account", async () => {
    renderPanel({ group: "enforcer", account: buildAccount({ status: "suspended" }) });

    expect(await screen.findByRole("button", { name: "Unsuspend account" })).toBeTruthy();
    expect(queryButton("Suspend account")).toBeNull();
    expect(queryButton("Mark as spam")).not.toBeNull();
  });

  it("does not offer mark as spam on an account that is already marked", async () => {
    renderPanel({ group: "enforcer", account: buildAccount({ spam_marked_at: markedAt }) });

    expect(await screen.findByRole("button", { name: "Suspend account" })).toBeTruthy();
    expect(queryButton("Mark as spam")).toBeNull();
  });

  it.each<StaffGroup>(["viewer", "analyst"])(
    "offers nothing to a %s, and says the group cannot enforce",
    async (group) => {
      renderPanel({ group, account: buildAccount({ status: "suspended" }) });

      expect(await screen.findByText(/cannot enforce/)).toBeTruthy();
      expect(queryButton("Suspend account")).toBeNull();
      expect(queryButton("Unsuspend account")).toBeNull();
      expect(queryButton("Mark as spam")).toBeNull();
    },
  );

  it("replaces the unsuspend button with an explanation during lockdown", async () => {
    renderPanel({
      group: "enforcer",
      account: buildAccount({ status: "suspended" }),
      mode: lockdown,
    });

    expect(
      await screen.findByText(/Unsuspend is switched off during lockdown/),
    ).toBeTruthy();
    expect(queryButton("Unsuspend account")).toBeNull();
    expect(queryButton("Mark as spam")).not.toBeNull();
  });

  it("handles a 409 blocked_by_lockdown when the mode changed after the page loaded", async () => {
    const user = userEvent.setup();
    const unsuspendAccount = jest
      .fn<ApiClient["unsuspendAccount"]>()
      .mockRejectedValue(
        buildApiError(409, "blocked_by_lockdown", "Unsuspend is refused in lockdown."),
      );
    renderPanel({
      group: "enforcer",
      account: buildAccount({ status: "suspended" }),
      answers: { unsuspendAccount },
    });

    await user.click(await screen.findByRole("button", { name: "Unsuspend account" }));
    await user.type(screen.getByLabelText("Reason"), typedReason);
    await user.click(screen.getByRole("button", { name: "Lift the suspension" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Unsuspend is switched off during lockdown");
    expect(alert.textContent).toContain(correlationId);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByLabelText("Reason").textContent).toBe(typedReason);
  });

  it("unsuspends with the reason and confirms with the audit row", async () => {
    const user = userEvent.setup();
    const unsuspendAccount = jest.fn<ApiClient["unsuspendAccount"]>().mockResolvedValue({
      ...enforcementResult,
      enforcement_action: { ...enforcementResult.enforcement_action, action_type: "unsuspend" },
      account: { ...enforcementResult.account, status: "active" },
    });
    renderPanel({
      group: "enforcer",
      account: buildAccount({ status: "suspended" }),
      answers: { unsuspendAccount },
    });

    await user.click(await screen.findByRole("button", { name: "Unsuspend account" }));
    await user.type(screen.getByLabelText("Reason"), typedReason);
    await user.click(screen.getByRole("button", { name: "Lift the suspension" }));

    const confirmation = await screen.findByRole("status");
    expect(confirmation.textContent).toContain("Suspension lifted.");
    expect(confirmation.textContent).toContain("Audit row 1");
    // The account in this test does not refresh, so the button stays on the
    // page. Focus must still end up on the confirmation and stay there.
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    expect(document.activeElement).toBe(confirmation);
    expect(unsuspendAccount).toHaveBeenCalledWith(
      42,
      { reason: typedReason },
      expect.stringMatching(uuidPattern),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("marks as spam with the reason and confirms", async () => {
    const user = userEvent.setup();
    const markAccountAsSpam = jest.fn<ApiClient["markAccountAsSpam"]>().mockResolvedValue({
      ...enforcementResult,
      enforcement_action: { ...enforcementResult.enforcement_action, action_type: "mark_spam" },
      account: { id: 42, status: "active", spam_marked_at: markedAt },
    });
    renderPanel({
      group: "enforcer",
      account: buildAccount(),
      answers: { markAccountAsSpam },
    });

    await user.click(await screen.findByRole("button", { name: "Mark as spam" }));
    await user.type(screen.getByLabelText("Reason"), typedReason);
    await user.click(screen.getByRole("button", { name: "Confirm spam mark" }));

    const confirmation = await screen.findByRole("status");
    expect(confirmation.textContent).toContain("Account marked as spam.");
    expect(markAccountAsSpam).toHaveBeenCalledWith(
      42,
      { reason: typedReason },
      expect.stringMatching(uuidPattern),
    );
  });

  it("sends the same Idempotency-Key on two submits, and a new one after reopening", async () => {
    const user = userEvent.setup();
    const suspendAccount = jest
      .fn<ApiClient["suspendAccount"]>()
      .mockRejectedValue(buildApiError(503, "core_api_unavailable", "Not available."));
    renderPanel({ group: "enforcer", account: buildAccount(), answers: { suspendAccount } });

    await user.click(await screen.findByRole("button", { name: "Suspend account" }));
    await user.type(screen.getByLabelText("Reason"), typedReason);
    await user.click(screen.getByRole("button", { name: "Confirm suspension" }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Confirm suspension" }));
    await waitFor(() => {
      expect(suspendAccount).toHaveBeenCalledTimes(2);
    });
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Suspend account" }));
    await user.click(screen.getByRole("button", { name: "Confirm suspension" }));
    await waitFor(() => {
      expect(suspendAccount).toHaveBeenCalledTimes(3);
    });

    const keys = suspendAccount.mock.calls.map(([, , idempotencyKey]) => idempotencyKey);
    expect(keys[0]).toMatch(uuidPattern);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).toMatch(uuidPattern);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it("gives each action its own key", async () => {
    const user = userEvent.setup();
    const refusal = buildApiError(503, "core_api_unavailable", "Not available.");
    const suspendAccount = jest.fn<ApiClient["suspendAccount"]>().mockRejectedValue(refusal);
    const markAccountAsSpam = jest
      .fn<ApiClient["markAccountAsSpam"]>()
      .mockRejectedValue(refusal);
    renderPanel({
      group: "enforcer",
      account: buildAccount(),
      answers: { suspendAccount, markAccountAsSpam },
    });

    await user.click(await screen.findByRole("button", { name: "Suspend account" }));
    await user.type(screen.getByLabelText("Reason"), typedReason);
    await user.click(screen.getByRole("button", { name: "Confirm suspension" }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByRole("button", { name: "Mark as spam" }));
    await user.type(screen.getByLabelText("Reason"), typedReason);
    await user.click(screen.getByRole("button", { name: "Confirm spam mark" }));
    await screen.findByRole("alert");

    expect(markAccountAsSpam.mock.calls[0]?.[2]).toMatch(uuidPattern);
    expect(markAccountAsSpam.mock.calls[0]?.[2]).not.toBe(suspendAccount.mock.calls[0]?.[2]);
  });
});
