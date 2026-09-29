import type { OperationalModeName } from "@trust-desk/shared";

/** The text shown for each operational mode. */
export const modeLabels: Readonly<Record<OperationalModeName, string>> = {
  normal: "Normal",
  elevated: "Elevated",
  lockdown: "Lockdown",
};

/** One line on what each operational mode changes. */
export const modeDescriptions: Readonly<Record<OperationalModeName, string>> = {
  normal: "Accounts are flagged for review at the usual risk score.",
  elevated: "Accounts are flagged for review at a lower risk score.",
  lockdown:
    "Accounts are flagged for review at a lower risk score, and nobody can lift a suspension.",
};
