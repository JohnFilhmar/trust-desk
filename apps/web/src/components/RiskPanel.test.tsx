import { describe, expect, it, jest } from "@jest/globals";
import type { RiskScore } from "@trust-desk/shared";
import { screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { RiskPanel } from "@/components/RiskPanel";
import type { ApiClient } from "@/lib/api/apiClient";
import { buildApiError, buildRiskScore, buildSession, correlationId } from "@/testUtils/fixtures";
import { buildApiClient, renderWithProviders } from "@/testUtils/renderWithProviders";

function renderPanel(fetchAccountRisk: ApiClient["fetchAccountRisk"]): void {
  renderWithProviders(
    <main>
      <RiskPanel accountId={42} />
    </main>,
    {
      apiClient: buildApiClient({
        fetchSession: () => Promise.resolve(buildSession("viewer")),
        fetchAccountRisk,
      }),
    },
  );
}

function answering(risk: RiskScore): jest.Mock<ApiClient["fetchAccountRisk"]> {
  return jest.fn<ApiClient["fetchAccountRisk"]>().mockResolvedValue(risk);
}

describe("RiskPanel", () => {
  it("shows the score, the band in words, the threshold and the flag", async () => {
    const fetchAccountRisk = answering(buildRiskScore());
    renderPanel(fetchAccountRisk);

    expect(await screen.findByText("72 out of 100", { selector: "p" })).toBeTruthy();
    expect(fetchAccountRisk).toHaveBeenCalledWith(42);
    expect(screen.getByText("High risk")).toBeTruthy();
    expect(screen.getByText("Review")).toBeTruthy();
    expect(screen.getByText(/at or above the review threshold of 60/)).toBeTruthy();
  });

  it("gives the score bar a name and a value", async () => {
    renderPanel(answering(buildRiskScore()));

    const meter = await screen.findByRole("meter", { name: "Risk score" });
    expect(meter.getAttribute("value")).toBe("72");
    expect(meter.getAttribute("min")).toBe("0");
    expect(meter.getAttribute("max")).toBe("100");
  });

  it("says an account below the threshold is not flagged", async () => {
    renderPanel(
      answering(buildRiskScore({ score: 12, band: "low", flagged_for_review: false })),
    );

    expect(await screen.findByText(/Not flagged/)).toBeTruthy();
    expect(screen.getByText("Low risk")).toBeTruthy();
    expect(screen.queryByText("Review")).toBeNull();
  });

  it("renders every signal in the order given, a zero-point one included", async () => {
    renderPanel(answering(buildRiskScore()));

    const list = await screen.findByRole("list", { name: "Risk signals" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    const [first, second, third] = items;
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error("The list has fewer signals than the test gave it.");
    }
    expect(first.textContent).toContain("Shared device fingerprint");
    expect(first.textContent).toContain("30 of 30 points");
    expect(first.textContent).toContain(
      "12 other accounts signed up with the same device fingerprint.",
    );
    expect(second.textContent).toContain("Abuse reports");
    expect(second.textContent).toContain("20 of 30 points");
    expect(third.textContent).toContain("Disposable email domain");
    expect(third.textContent).toContain("0 of 10 points");
    expect(third.textContent).toContain("The email domain is not on the disposable list.");
  });

  it("does not show the fallback sentence when every day came from the table", async () => {
    renderPanel(answering(buildRiskScore()));

    expect(
      await screen.findByText(/30 days from the pre-aggregated table, 0 days from raw events/),
    ).toBeTruthy();
    expect(screen.queryByText(/missing or out of date/)).toBeNull();
  });

  it("shows the fallback sentence when days came from raw events", async () => {
    renderPanel(
      answering(buildRiskScore({ source: { days_from_stats: 27, days_from_fallback: 3 } })),
    );

    expect(
      await screen.findByText(/27 days from the pre-aggregated table, 3 days from raw events/),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /3 days of activity were counted from raw events, because the pre-aggregated row was missing or out of date/,
      ),
    ).toBeTruthy();
  });

  it("shows the message and the correlation id when the score cannot be loaded", async () => {
    renderPanel(
      jest
        .fn<ApiClient["fetchAccountRisk"]>()
        .mockRejectedValue(buildApiError(404, "account_not_found", "No account has this id.")),
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("No account has this id.");
    expect(alert.textContent).toContain(correlationId);
  });

  it("has no accessibility violations axe can detect", async () => {
    renderPanel(answering(buildRiskScore()));
    await screen.findByRole("meter", { name: "Risk score" });

    const results = await axe(document.body);

    expect(results.violations).toEqual([]);
  });
});
