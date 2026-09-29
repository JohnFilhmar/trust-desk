import type { EnforcementActionType, EnforcementResult } from "@trust-desk/shared";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { ReasonDialog } from "@/components/ReasonDialog";
import type { ButtonProps } from "@/components/ui/Button";
import { ApiError } from "@/lib/api/apiError";
import { operationalModeKey } from "@/lib/api/detailQueryKeys";
import { accountsKey, auditLogsKey } from "@/lib/api/queryKeys";
import { useApiClient } from "@/providers/ApiClientProvider";

/** Props of `EnforcementDialog`. */
export type EnforcementDialogProps = {
  /** The account to act on. */
  accountId: number;
  /** Which of the three enforcement actions this dialog takes. */
  actionType: EnforcementActionType;
  isOpen: boolean;
  /** Runs when the dialog asks to open or close. */
  onOpenChange: (isOpen: boolean) => void;
  /** Runs once the server has acted. The caller closes the dialog. */
  onEnforced: (result: EnforcementResult) => void;
};

type DialogCopy = {
  triggerLabel: string;
  variant: NonNullable<ButtonProps["variant"]>;
  title: string;
  description: string;
  submitLabel: string;
  pendingLabel: string;
  failureHeading: string;
  failureHeadingsByCode: Readonly<Record<string, string>>;
};

const reasonNote =
  "The reason goes into the audit trail, where every staff user can read it.";

const copyByActionType: Readonly<Record<EnforcementActionType, DialogCopy>> = {
  suspend: {
    triggerLabel: "Suspend account",
    variant: "danger",
    title: "Suspend account",
    description: `The account loses access at once. ${reasonNote}`,
    submitLabel: "Confirm suspension",
    pendingLabel: "Suspending account",
    failureHeading: "The account was not suspended",
    failureHeadingsByCode: { already_suspended: "This account was already suspended" },
  },
  unsuspend: {
    triggerLabel: "Unsuspend account",
    variant: "secondary",
    title: "Unsuspend account",
    description: `The account gets its access back at once. ${reasonNote}`,
    submitLabel: "Lift the suspension",
    pendingLabel: "Lifting the suspension",
    failureHeading: "The suspension was not lifted",
    failureHeadingsByCode: {
      not_suspended: "This account is not suspended",
      blocked_by_lockdown: "Unsuspend is switched off during lockdown",
    },
  },
  mark_spam: {
    triggerLabel: "Mark as spam",
    variant: "secondary",
    title: "Mark account as spam",
    description: `The account keeps its status and gets a spam mark. ${reasonNote}`,
    submitLabel: "Confirm spam mark",
    pendingLabel: "Marking as spam",
    failureHeading: "The account was not marked as spam",
    failureHeadingsByCode: {
      already_marked_spam: "This account was already marked as spam",
    },
  },
};

/**
 * Renders the button and the dialog for one enforcement action. After the
 * action it refreshes the account, the lists and the audit trail. A 409 means
 * the page is out of date, so it refreshes the account and the mode.
 *
 * @param props - See `EnforcementDialogProps`.
 */
export function EnforcementDialog({
  accountId,
  actionType,
  isOpen,
  onOpenChange,
  onEnforced,
}: EnforcementDialogProps): ReactElement {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const copy = copyByActionType[actionType];
  const send = {
    suspend: apiClient.suspendAccount,
    unsuspend: apiClient.unsuspendAccount,
    mark_spam: apiClient.markAccountAsSpam,
  }[actionType];

  return (
    <ReasonDialog
      {...copy}
      title={`${copy.title} ${accountId}`}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      returnsFocusAfterSuccess={false}
      onSubmit={(reason, idempotencyKey) => send(accountId, { reason }, idempotencyKey)}
      onSuccess={(result) => {
        void queryClient.invalidateQueries({ queryKey: accountsKey() });
        void queryClient.invalidateQueries({ queryKey: auditLogsKey() });
        onEnforced(result);
      }}
      onFailure={(error) => {
        if (error instanceof ApiError && error.status === 409) {
          void queryClient.invalidateQueries({ queryKey: accountsKey() });
          void queryClient.invalidateQueries({ queryKey: operationalModeKey() });
        }
      }}
    />
  );
}
