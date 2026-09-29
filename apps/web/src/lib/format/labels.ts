import type {
  AccountStatus,
  AuditAction,
  EnforcementActionType,
  StaffGroup,
} from "@trust-desk/shared";

/** The text shown for each account status. */
export const accountStatusLabels: Readonly<Record<AccountStatus, string>> = {
  active: "Active",
  suspended: "Suspended",
};

/** The text shown for each action in the audit trail. */
export const auditActionLabels: Readonly<Record<AuditAction, string>> = {
  "account.suspend": "Suspended an account",
  "account.unsuspend": "Lifted a suspension",
  "account.mark_spam": "Marked an account as spam",
  "pii.reveal": "Revealed personal data",
  "mode.change": "Changed the operational mode",
};

/** The text shown for each enforcement action on an account. */
export const enforcementActionLabels: Readonly<Record<EnforcementActionType, string>> = {
  suspend: "Suspended",
  unsuspend: "Suspension lifted",
  mark_spam: "Marked as spam",
};

/** The text shown for each staff group. */
export const staffGroupLabels: Readonly<Record<StaffGroup, string>> = {
  viewer: "Viewer",
  analyst: "Analyst",
  enforcer: "Enforcer",
};
