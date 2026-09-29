import * as RadixDialog from "@radix-ui/react-dialog";
import type { ReactElement, ReactNode } from "react";

/** Props of `Dialog`. */
export type DialogProps = {
  isOpen: boolean;
  /** Runs when the dialog asks to open or close, which includes Escape and a click outside it. */
  onOpenChange: (isOpen: boolean) => void;
  /** The heading of the dialog, read out when it opens. */
  title: string;
  /** One or two sentences under the heading, read out with it. */
  description: string;
  /** The one element that opens the dialog. It must pass a ref and its props to a button. Focus returns to it on close. */
  trigger: ReactElement;
  children: ReactNode;
};

/**
 * Renders a modal dialog that traps focus and closes on Escape.
 *
 * @param props - See `DialogProps`.
 */
export function Dialog({
  isOpen,
  onOpenChange,
  title,
  description,
  trigger,
  children,
}: DialogProps): ReactElement {
  return (
    <RadixDialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 bg-ink/50" />
        <RadixDialog.Content className="fixed top-1/2 left-1/2 flex w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border border-line bg-surface p-6 shadow-lg">
          <div className="flex flex-col gap-1">
            <RadixDialog.Title className="text-lg font-semibold">{title}</RadixDialog.Title>
            <RadixDialog.Description className="text-sm text-ink-muted">
              {description}
            </RadixDialog.Description>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
