import type { RiskBand } from "@trust-desk/shared";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/Badge";
import type { BadgeProps } from "@/components/ui/Badge";
import { riskBandLabels } from "@/lib/format/investigationLabels";

/** Props of `RiskBadge`. */
export type RiskBadgeProps = {
  band: RiskBand;
};

const toneByBand: Readonly<Record<RiskBand, NonNullable<BadgeProps["tone"]>>> = {
  low: "positive",
  medium: "warning",
  high: "danger",
};

/**
 * Shows a risk band in words, with a color to back the words up.
 *
 * @param props - See `RiskBadgeProps`.
 */
export function RiskBadge({ band }: RiskBadgeProps): ReactElement {
  return <Badge tone={toneByBand[band]}>{riskBandLabels[band]} risk</Badge>;
}
