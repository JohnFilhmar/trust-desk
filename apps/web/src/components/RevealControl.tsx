import type { RevealResponse } from "@trust-desk/shared";
import { useState } from "react";
import type { ReactElement } from "react";
import { ReasonDialog } from "@/components/ReasonDialog";
import { Badge } from "@/components/ui/Badge";
import { useFocusOnChange } from "@/lib/focus/useFocusOnChange";
import { staffGroupLabels } from "@/lib/format/labels";
import { useApiClient } from "@/providers/ApiClientProvider";
import { useSession } from "@/providers/SessionProvider";

/** Props of `RevealControl`. */
export type RevealControlProps = {
  /** The account on the page. */
  accountId: number;
  /** What the last reveal on this page returned, or null while the page shows masked values. */
  revealed: RevealResponse | null;
  /** Runs with the unmasked account. The caller keeps it in React state and nowhere else. */
  onRevealed: (response: RevealResponse) => void;
};

/**
 * Offers the "Reveal PII" button to a user who may reveal, says why not to
 * one who may not, and marks the page once values are revealed.
 *
 * @param props - See `RevealControlProps`.
 */
export function RevealControl({
  accountId,
  revealed,
  onRevealed,
}: RevealControlProps): ReactElement | null {
  const apiClient = useApiClient();
  const { user, can } = useSession();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const markerRef = useFocusOnChange<HTMLParagraphElement>(revealed);

  if (user === null) {
    return null;
  }
  if (!can("pii.reveal")) {
    return (
      <p className="text-sm text-ink-muted">
        Your group, {staffGroupLabels[user.group_name]}, cannot reveal personal data. It stays
        masked on this page.
      </p>
    );
  }
  if (revealed !== null) {
    return (
      <p
        ref={markerRef}
        tabIndex={-1}
        role="status"
        className="flex items-center gap-2 rounded-sm text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Badge tone="warning">Revealed</Badge>
        Personal data is unmasked until you leave this page. Audit row {revealed.audit_log_id}{" "}
        holds the record.
      </p>
    );
  }
  return (
    <div>
      <ReasonDialog
        triggerLabel="Reveal PII"
        title={`Reveal the PII of account ${accountId}`}
        description="The email, signup IP address, device fingerprint and user agent are shown unmasked until you leave the page. The reason goes into the audit trail, where every staff user can read it."
        submitLabel="Reveal"
        pendingLabel="Revealing"
        failureHeading="Nothing was revealed"
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        returnsFocusAfterSuccess={false}
        onSubmit={(reason) => apiClient.revealAccountPii(accountId, { reason })}
        onSuccess={(response) => {
          setIsDialogOpen(false);
          onRevealed(response);
        }}
      />
    </div>
  );
}
