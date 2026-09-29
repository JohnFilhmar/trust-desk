import { operational_mode_name_schema } from "@trust-desk/shared";
import type { OperationalModeName } from "@trust-desk/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import type { ReactElement } from "react";
import { ReasonDialog } from "@/components/ReasonDialog";
import { operationalModeKey } from "@/lib/api/detailQueryKeys";
import { accountsKey, auditLogsKey } from "@/lib/api/queryKeys";
import { modeDescriptions, modeLabels } from "@/lib/format/modeLabels";
import { useOperationalMode } from "@/lib/mode/useOperationalMode";
import { useApiClient } from "@/providers/ApiClientProvider";

/**
 * Renders the "Change mode" button and its dialog: a choice of the three
 * modes and a reason. The mode in force cannot be chosen. After a change it
 * refreshes the mode, the accounts and the audit trail.
 */
export function ModeChangeDialog(): ReactElement {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const modeInForce = useOperationalMode().data?.mode;
  const [isOpen, setIsOpen] = useState(false);
  const [chosenMode, setChosenMode] = useState<OperationalModeName | null>(null);
  const groupName = useId();

  async function changeMode(reason: string): Promise<void> {
    if (chosenMode === null) {
      return;
    }
    const mode = await apiClient.changeOperationalMode({ mode: chosenMode, reason });
    queryClient.setQueryData(operationalModeKey(), mode);
  }

  return (
    <ReasonDialog
      triggerLabel="Change mode"
      title="Change the operational mode"
      description="The mode changes for every staff user at once. The reason shows in the banner and goes into the audit trail."
      submitLabel="Change mode"
      pendingLabel="Changing mode"
      failureHeading="The mode was not changed"
      failureHeadingsByCode={{ mode_unchanged: "This mode is already in force" }}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      canSubmit={chosenMode !== null && chosenMode !== modeInForce}
      onSubmit={changeMode}
      onSuccess={() => {
        void queryClient.invalidateQueries({ queryKey: accountsKey() });
        void queryClient.invalidateQueries({ queryKey: auditLogsKey() });
        setChosenMode(null);
        setIsOpen(false);
      }}
      onFailure={() => {
        void queryClient.invalidateQueries({ queryKey: operationalModeKey() });
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Mode</legend>
        {operational_mode_name_schema.options.map((mode) => (
          <label key={mode} className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name={groupName}
              value={mode}
              checked={chosenMode === mode}
              disabled={mode === modeInForce}
              onChange={() => {
                setChosenMode(mode);
              }}
              className="mt-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <span className="flex flex-col">
              <span className="font-medium">
                {modeLabels[mode]}
                {mode === modeInForce && ", in force now"}
              </span>
              <span className="text-ink-muted">{modeDescriptions[mode]}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </ReasonDialog>
  );
}
