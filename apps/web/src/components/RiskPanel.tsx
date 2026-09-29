import { useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { RiskBadge } from "@/components/RiskBadge";
import { Badge } from "@/components/ui/Badge";
import { accountRiskKey } from "@/lib/api/detailQueryKeys";
import { useApiClient } from "@/providers/ApiClientProvider";

/** Props of `RiskPanel`. */
export type RiskPanelProps = {
  /** The account on the page. */
  accountId: number;
};

function countDays(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

/**
 * Shows the full risk score of an account and every signal behind it,
 * including the signals that added nothing.
 *
 * @param props - See `RiskPanelProps`.
 */
export function RiskPanel({ accountId }: RiskPanelProps): ReactElement {
  const apiClient = useApiClient();
  const riskQuery = useQuery({
    queryKey: accountRiskKey(accountId),
    queryFn: () => apiClient.fetchAccountRisk(accountId),
  });
  const risk = riskQuery.data;

  return (
    <section aria-labelledby="risk-heading" className="flex flex-col gap-3">
      <h2 id="risk-heading" className="text-lg font-semibold">
        Risk
      </h2>
      {riskQuery.isPending && <LoadingState label="Loading the risk score" />}
      {riskQuery.isError && (
        <ErrorState error={riskQuery.error} heading="The risk score could not be loaded" />
      )}
      {risk !== undefined && (
        <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <p className="text-2xl font-semibold">{risk.score} out of 100</p>
              <RiskBadge band={risk.band} />
              {risk.flagged_for_review && <Badge tone="danger">Review</Badge>}
            </div>
            <meter
              aria-label="Risk score"
              min={0}
              max={100}
              value={risk.score}
              className="h-3 w-full"
            >
              {risk.score} out of 100
            </meter>
            <p className="text-sm text-ink-muted">
              {risk.flagged_for_review
                ? `Flagged for review. The score is at or above the review threshold of ${risk.review_threshold}.`
                : `Not flagged. The score is below the review threshold of ${risk.review_threshold}.`}
            </p>
          </div>
          <ul aria-label="Risk signals" className="flex flex-col gap-3">
            {risk.signals.map((signal) => (
              <li key={signal.key} className="flex flex-col gap-1 border-t border-line pt-3">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium">{signal.label}</p>
                  <p className="text-sm">
                    {signal.points} of {signal.max_points} points
                  </p>
                </div>
                <meter
                  aria-label={`${signal.label}, points`}
                  min={0}
                  max={signal.max_points}
                  value={signal.points}
                  className="h-2 w-full"
                >
                  {signal.points} of {signal.max_points} points
                </meter>
                <p className="text-sm text-ink-muted">{signal.explanation}</p>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-1 border-t border-line pt-3 text-sm text-ink-muted">
            <p>
              Source: {countDays(risk.source.days_from_stats)} from the pre-aggregated table,{" "}
              {countDays(risk.source.days_from_fallback)} from raw events.
            </p>
            {risk.source.days_from_fallback > 0 && (
              <p>
                {countDays(risk.source.days_from_fallback)} of activity{" "}
                {risk.source.days_from_fallback === 1 ? "was" : "were"} counted from raw events,
                because the pre-aggregated row was missing or out of date.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
