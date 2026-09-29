import { enforcement_request_schema, reason_schema } from "@trust-desk/shared";
import type { EnforcementRequest, EnforcementResult } from "@trust-desk/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { ErrorState } from "@/components/ErrorState";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ApiError } from "@/lib/api/apiError";
import { accountsKey, auditLogsKey } from "@/lib/api/queryKeys";
import { useApiClient } from "@/providers/ApiClientProvider";

/** Props of `SuspendDialog`. */
export type SuspendDialogProps = {
  /** The account to suspend. */
  accountId: number;
  isOpen: boolean;
  /** Runs when the dialog asks to open or close. It does not ask to close while a request runs. */
  onOpenChange: (isOpen: boolean) => void;
  /** Runs once the server has suspended the account. The caller closes the dialog. */
  onSuspended: (result: EnforcementResult) => void;
};

const minimumLength = reason_schema.minLength ?? 0;
const maximumLength = reason_schema.maxLength ?? 0;

/**
 * Renders the "Suspend account" button and the dialog that asks for a reason.
 * A failed request leaves the dialog open with the reason still in it.
 *
 * @param props - See `SuspendDialogProps`.
 */
export function SuspendDialog({
  accountId,
  isOpen,
  onOpenChange,
  onSuspended,
}: SuspendDialogProps): ReactElement {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const reasonId = useId();
  const hintId = useId();

  const suspendMutation = useMutation({
    mutationFn: (request: EnforcementRequest) => apiClient.suspendAccount(accountId, request),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: accountsKey() });
      void queryClient.invalidateQueries({ queryKey: auditLogsKey() });
      setReason("");
      onSuspended(result);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: accountsKey() });
      }
    },
  });

  const request = enforcement_request_schema.safeParse({ reason });
  const trimmedLength = reason.trim().length;
  const isAlreadySuspended =
    suspendMutation.error instanceof ApiError && suspendMutation.error.status === 409;

  function handleOpenChange(isNextOpen: boolean): void {
    if (suspendMutation.isPending) {
      return;
    }
    if (isNextOpen) {
      suspendMutation.reset();
    }
    onOpenChange(isNextOpen);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (request.success && !suspendMutation.isPending) {
      suspendMutation.mutate(request.data);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      title={`Suspend account ${accountId}`}
      description="The account loses access at once. The reason goes into the audit trail, where every staff user can read it."
      trigger={<Button variant="danger">Suspend account</Button>}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={reasonId} className="text-sm font-medium">
            Reason
          </label>
          <textarea
            id={reasonId}
            rows={5}
            value={reason}
            aria-describedby={hintId}
            aria-invalid={reason !== "" && !request.success}
            onChange={(event) => {
              setReason(event.target.value);
            }}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          <p id={hintId} className="text-sm text-ink-muted">
            {trimmedLength} of {maximumLength} characters. A reason needs at least{" "}
            {minimumLength}, not counting spaces at either end.
          </p>
        </div>
        {suspendMutation.isError && (
          <ErrorState
            error={suspendMutation.error}
            heading={
              isAlreadySuspended
                ? "This account was already suspended"
                : "The account was not suspended"
            }
          />
        )}
        <div className="flex justify-end gap-3">
          <Button
            disabled={suspendMutation.isPending}
            onClick={() => {
              handleOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={!request.success || suspendMutation.isPending}
          >
            {suspendMutation.isPending ? "Suspending account" : "Confirm suspension"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
