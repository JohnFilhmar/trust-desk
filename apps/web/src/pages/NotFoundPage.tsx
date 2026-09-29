import type { ReactElement } from "react";
import { TextLink } from "@/components/ui/TextLink";

/** Tells the visitor that the address matches no page, and offers a way back. */
export function NotFoundPage(): ReactElement {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-8 py-16">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-ink-muted">Nothing lives at this address.</p>
      <TextLink to="/accounts">Go to accounts</TextLink>
    </div>
  );
}
