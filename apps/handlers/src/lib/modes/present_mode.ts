import type { OperationalMode, OperationalModeName } from "@trust-desk/shared";
import type { Database } from "#app/interfaces/deps.ts";
import { risk_config } from "#app/lib/risk/risk_config.ts";
import type { CurrentModeRow } from "#app/types/rows.ts";

// What the console shows before anyone has set a mode. The seed always
// writes one row, so this is seen only on an empty database.
const never_set = {
  reason: "No mode has been set yet.",
  changed_by: { id: 1, display_name: "System" },
  changed_at: "1970-01-01T00:00:00.000000Z",
};

/**
 * Reads the name of the operational mode in force.
 *
 * @param db - The read-side queries.
 * @returns The mode of the newest row, or `normal` when none was ever set.
 */
export async function current_mode_name(db: Database): Promise<OperationalModeName> {
  return (await db.find_current_mode())?.mode ?? "normal";
}

/**
 * Turns the newest mode row into what the console shows, with the two
 * effects the mode has.
 *
 * @param row - The newest row, or `null` when no mode was ever set.
 * @returns The mode, who set it and why, the review threshold, and whether
 *   unsuspend is allowed.
 */
export function present_mode(row: CurrentModeRow | null): OperationalMode {
  const mode = row?.mode ?? "normal";
  return {
    mode,
    reason: row?.reason ?? never_set.reason,
    changed_by:
      row === null
        ? never_set.changed_by
        : { id: row.staff_user_id, display_name: row.display_name },
    changed_at: row?.created_at ?? never_set.changed_at,
    review_threshold: risk_config.review_threshold[mode],
    unsuspend_allowed: mode !== "lockdown",
  };
}
