import type { OperationalModeName } from "@trust-desk/shared";
import type { ReactElement } from "react";
import { Timestamp } from "@/components/Timestamp";
import { modeLabels } from "@/lib/format/modeLabels";
import { useOperationalMode } from "@/lib/mode/useOperationalMode";

const borderClasses: Readonly<Record<OperationalModeName, string>> = {
  normal: "border-line",
  elevated: "border-risk-medium",
  lockdown: "border-risk-high",
};

/**
 * Tells every signed-in user that the console is in elevated or lockdown
 * mode, why, and who set it. It shows nothing in normal mode, while the mode
 * loads, and when the mode could not be read.
 */
export function ModeBanner(): ReactElement | null {
  const mode = useOperationalMode().data;
  if (mode === undefined || mode.mode === "normal") {
    return null;
  }
  return (
    <div
      role="status"
      aria-label="Operational mode"
      className={`border-l-4 bg-surface px-8 py-3 text-sm ${borderClasses[mode.mode]}`}
    >
      <p>
        <span className="font-semibold">{modeLabels[mode.mode]} mode.</span> {mode.reason}
      </p>
      <p className="text-ink-muted">
        Set by {mode.changed_by.display_name}, <Timestamp value={mode.changed_at} />. Accounts
        are flagged for review at a risk score of {mode.review_threshold}.
        {!mode.unsuspend_allowed && " Nobody can lift a suspension."}
      </p>
    </div>
  );
}
