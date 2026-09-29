import { reason_schema } from "@trust-desk/shared";
import { useId, useRef, useState } from "react";
import type { FormEvent, ReactElement, ReactNode } from "react";
import { ErrorState } from "@/components/ErrorState";
import { Button } from "@/components/ui/Button";
import type { ButtonProps } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ApiError } from "@/lib/api/apiError";
import { createUuid } from "@/lib/ids/createUuid";

/** Props of `ReasonDialog`. `TResult` is what the server answers on success. */
export type ReasonDialogProps<TResult> = {
  /** The text of the button that opens the dialog. */
  triggerLabel: string;
  /** The look of the button that opens the dialog, and of the submit button. Defaults to `secondary`. */
  variant?: ButtonProps["variant"];
  title: string;
  /** Says what the action does and where the reason ends up. */
  description: string;
  submitLabel: string;
  /** Replaces the submit label while the request runs. */
  pendingLabel: string;
  /** The heading over any failure that has no heading of its own. */
  failureHeading: string;
  /** Headings for error codes that deserve their own wording, keyed by code. */
  failureHeadingsByCode?: Readonly<Record<string, string>>;
  isOpen: boolean;
  /** Runs when the dialog asks to open or close. It does not ask to close while a request runs. */
  onOpenChange: (isOpen: boolean) => void;
  /**
   * Sends the request. It gets the trimmed reason, and a key that stays the
   * same for every submit until the dialog closes.
   */
  onSubmit: (reason: string, idempotencyKey: string) => Promise<TResult>;
  /** Runs once the server has answered. The caller closes the dialog. */
  onSuccess: (result: TResult) => void;
  /**
   * False when the caller moves focus to its own confirmation after a
   * success, because the button that opened the dialog is about to leave
   * the page. Closing any other way always returns focus to the button.
   * Defaults to true.
   */
  returnsFocusAfterSuccess?: boolean;
  /** Runs after a failure. The dialog stays open with the reason still in it. */
  onFailure?: (error: unknown) => void;
  /** Extra fields, shown above the reason. */
  children?: ReactNode;
  /** False keeps the submit button disabled whatever the reason holds. Defaults to true. */
  canSubmit?: boolean;
};

const minimumLength = reason_schema.minLength ?? 0;
const maximumLength = reason_schema.maxLength ?? 0;

const keyReusedCode = "idempotency_key_reused";

/**
 * Renders a button and the dialog it opens, which asks for a reason before
 * it sends a request. The result never enters the TanStack Query cache, so a
 * caller may use it for values that must stay in memory.
 *
 * @param props - See `ReasonDialogProps`.
 */
export function ReasonDialog<TResult>({
  triggerLabel,
  variant = "secondary",
  title,
  description,
  submitLabel,
  pendingLabel,
  failureHeading,
  failureHeadingsByCode = {},
  isOpen,
  onOpenChange,
  onSubmit,
  onSuccess,
  returnsFocusAfterSuccess = true,
  onFailure,
  children,
  canSubmit = true,
}: ReasonDialogProps<TResult>): ReactElement {
  const hasJustSucceeded = useRef(false);
  const [reason, setReason] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(createUuid);
  const [isPending, setIsPending] = useState(false);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  const reasonId = useId();
  const hintId = useId();

  const parsedReason = reason_schema.safeParse(reason);
  const trimmedLength = reason.trim().length;
  const failureCode = failure?.error instanceof ApiError ? failure.error.code : "";
  const isKeyReused = failureCode === keyReusedCode;

  function handleOpenChange(isNextOpen: boolean): void {
    if (isPending) {
      return;
    }
    if (isNextOpen) {
      setFailure(null);
      setIdempotencyKey(createUuid());
    }
    onOpenChange(isNextOpen);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!parsedReason.success || !canSubmit || isPending) {
      return;
    }
    setIsPending(true);
    setFailure(null);
    try {
      const result = await onSubmit(parsedReason.data, idempotencyKey);
      setReason("");
      hasJustSucceeded.current = true;
      onSuccess(result);
    } catch (error) {
      setFailure({ error });
      onFailure?.(error);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      trigger={<Button variant={variant}>{triggerLabel}</Button>}
      onCloseAutoFocus={(event) => {
        if (hasJustSucceeded.current && !returnsFocusAfterSuccess) {
          event.preventDefault();
        }
        hasJustSucceeded.current = false;
      }}
    >
      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        noValidate
        className="flex flex-col gap-4"
      >
        {children}
        <div className="flex flex-col gap-1">
          <label htmlFor={reasonId} className="text-sm font-medium">
            Reason
          </label>
          <textarea
            id={reasonId}
            rows={5}
            value={reason}
            aria-describedby={hintId}
            aria-invalid={reason !== "" && !parsedReason.success}
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
        {failure !== null && (
          <ErrorState
            error={failure.error}
            heading={
              isKeyReused
                ? "This dialog already sent a different reason"
                : (failureHeadingsByCode[failureCode] ?? failureHeading)
            }
            message={
              isKeyReused
                ? "Close the dialog and open it again to send the new reason."
                : undefined
            }
          />
        )}
        <div className="flex justify-end gap-3">
          <Button
            disabled={isPending}
            onClick={() => {
              handleOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant={variant === "secondary" ? "primary" : variant}
            disabled={!parsedReason.success || !canSubmit || isPending}
          >
            {isPending ? pendingLabel : submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
