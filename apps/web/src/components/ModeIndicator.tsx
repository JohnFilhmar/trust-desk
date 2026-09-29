import type { ReactElement } from "react";
import { modeLabels } from "@/lib/format/modeLabels";
import { useOperationalMode } from "@/lib/mode/useOperationalMode";

/**
 * Shows the operational mode in the top bar while it is normal, and says so
 * when the mode could not be read. In elevated and lockdown mode the banner
 * takes over, so this shows nothing.
 */
export function ModeIndicator(): ReactElement | null {
  const modeQuery = useOperationalMode();
  if (modeQuery.isError) {
    return <p className="text-sm text-risk-high">Mode unknown</p>;
  }
  if (modeQuery.data?.mode !== "normal") {
    return null;
  }
  return <p className="text-sm text-ink-muted">Mode: {modeLabels.normal}</p>;
}
