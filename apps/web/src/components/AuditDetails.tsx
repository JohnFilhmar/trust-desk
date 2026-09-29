import { revealed_field_schema } from "@trust-desk/shared";
import type { ReactElement } from "react";
import { z } from "zod";
import { revealedFieldLabels } from "@/lib/format/investigationLabels";

/** Props of `AuditDetails`. */
export type AuditDetailsProps = {
  /** The `details` of an audit row. Nothing in it is trusted to have a shape. */
  details: Record<string, unknown>;
};

const fieldNamesSchema = z.array(z.string());

function labelField(name: string): string {
  const known = revealed_field_schema.safeParse(name);
  return known.success ? revealedFieldLabels[known.data] : name;
}

/**
 * Shows what an audit row says about its action: the reason when `reason`
 * is text, and the revealed fields when `fields` is a list of text. Every
 * other value is left out.
 *
 * @param props - See `AuditDetailsProps`.
 */
export function AuditDetails({ details }: AuditDetailsProps): ReactElement {
  const reason = typeof details["reason"] === "string" ? details["reason"] : "";
  const fields = fieldNamesSchema.safeParse(details["fields"]);
  return (
    <div className="flex flex-col gap-1 break-words">
      {reason !== "" && <p>{reason}</p>}
      {fields.success && fields.data.length > 0 && (
        <p className="text-ink-muted">
          Fields revealed: {fields.data.map(labelField).join(", ")}
        </p>
      )}
    </div>
  );
}
