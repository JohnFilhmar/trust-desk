import { describe, expect, it, jest } from "@jest/globals";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Timeline } from "@/components/Timeline";
import type { ApiClient } from "@/lib/api/apiClient";
import { buildApiError, buildEvent, buildSession, correlationId } from "@/testUtils/fixtures";
import { buildApiClient, renderWithProviders } from "@/testUtils/renderWithProviders";

function renderTimeline(fetchAccountEvents: ApiClient["fetchAccountEvents"]): void {
  renderWithProviders(
    <main>
      <Timeline accountId={42} />
    </main>,
    {
      apiClient: buildApiClient({
        fetchSession: () => Promise.resolve(buildSession("viewer")),
        fetchAccountEvents,
      }),
    },
  );
}

describe("Timeline", () => {
  it("renders events with a readable type, the time and the payload", async () => {
    const fetchAccountEvents = jest.fn<ApiClient["fetchAccountEvents"]>().mockResolvedValue({
      items: [
        buildEvent({ id: 2, event_type: "payment_failed", payload: { amount_cents: 4900 } }),
        buildEvent({ id: 1, event_type: "login" }),
      ],
      next_cursor: null,
    });
    renderTimeline(fetchAccountEvents);

    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(2);
    const [first, second] = items;
    if (first === undefined || second === undefined) {
      throw new Error("The timeline has fewer events than the test gave it.");
    }
    expect(first.textContent).toContain("Failed payment");
    expect(within(first).getByText("amount_cents")).toBeTruthy();
    expect(within(first).getByText("4900")).toBeTruthy();
    expect(second.textContent).toContain("Signed in");
    expect(within(second).getByText("192.0.2.***")).toBeTruthy();
    expect(within(second).getByTitle("2026-09-29 01:02:03 UTC")).toBeTruthy();
    expect(fetchAccountEvents).toHaveBeenCalledWith(42, {
      event_type: undefined,
      cursor: undefined,
    });
    expect(screen.queryByRole("button", { name: "Load more events" })).toBeNull();
  });

  it("renders a nested payload as JSON text, and every other kind of value", async () => {
    const fetchAccountEvents = jest.fn<ApiClient["fetchAccountEvents"]>().mockResolvedValue({
      items: [
        buildEvent({
          event_type: "abuse_report",
          payload: {
            reporter: { kind: "customer", ip: "198.51.100.***" },
            tags: ["phishing", 3],
            confirmed: false,
            note: null,
          },
        }),
      ],
      next_cursor: null,
    });
    renderTimeline(fetchAccountEvents);

    expect(
      await screen.findByText('{"kind":"customer","ip":"198.51.100.***"}'),
    ).toBeTruthy();
    expect(screen.getByText('["phishing",3]')).toBeTruthy();
    expect(screen.getByText("false")).toBeTruthy();
    expect(screen.getByText("None")).toBeTruthy();
  });

  it("says so when an event has an empty payload", async () => {
    renderTimeline(() =>
      Promise.resolve({ items: [buildEvent({ payload: {} })], next_cursor: null }),
    );

    expect(await screen.findByText("No details")).toBeTruthy();
  });

  it("loads a second page with the cursor the server sent", async () => {
    const user = userEvent.setup();
    const fetchAccountEvents = jest
      .fn<ApiClient["fetchAccountEvents"]>()
      .mockResolvedValueOnce({
        items: [buildEvent({ id: 2, event_type: "deploy", payload: { region: "sgp" } })],
        next_cursor: "cursor-2",
      })
      .mockResolvedValueOnce({
        items: [buildEvent({ id: 1, event_type: "signup", payload: { plan: "free" } })],
        next_cursor: null,
      });
    renderTimeline(fetchAccountEvents);

    await user.click(await screen.findByRole("button", { name: "Load more events" }));

    expect(await screen.findByText("free")).toBeTruthy();
    expect(screen.getByText("sgp")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(fetchAccountEvents).toHaveBeenLastCalledWith(42, {
      event_type: undefined,
      cursor: "cursor-2",
    });
    expect(screen.queryByRole("button", { name: "Load more events" })).toBeNull();
  });

  it("asks for one event type when the filter is set", async () => {
    const user = userEvent.setup();
    const fetchAccountEvents = jest
      .fn<ApiClient["fetchAccountEvents"]>()
      .mockResolvedValue({ items: [], next_cursor: null });
    renderTimeline(fetchAccountEvents);
    await screen.findByText("No events");

    await user.selectOptions(screen.getByLabelText("Event type"), "CPU spike");

    expect(await screen.findByText("No events")).toBeTruthy();
    expect(fetchAccountEvents).toHaveBeenLastCalledWith(42, {
      event_type: "cpu_spike",
      cursor: undefined,
    });
  });

  it("shows the message and the correlation id when the timeline cannot be loaded", async () => {
    renderTimeline(() =>
      Promise.reject(buildApiError(422, "invalid_request", "The cursor is not valid.")),
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The cursor is not valid.");
    expect(alert.textContent).toContain(correlationId);
  });
});
