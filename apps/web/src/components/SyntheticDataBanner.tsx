import type { ReactElement } from "react";

/** Tells every visitor that no record in the app describes a real person. */
export function SyntheticDataBanner(): ReactElement {
  return (
    <p className="bg-ink px-8 py-2 text-center text-sm text-surface">
      Demo with synthetic data. No account, email or IP address here belongs to a real person.
    </p>
  );
}
