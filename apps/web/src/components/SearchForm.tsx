import { useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { staffGroupLabels } from "@/lib/format/labels";
import { parseSearchTerms, searchTermNames } from "@/lib/search/searchTerms";
import type { SearchTerms } from "@/lib/search/searchTerms";
import { useSession } from "@/providers/SessionProvider";

const fieldLabels: Readonly<Record<keyof SearchTerms, string>> = {
  email: "Email, any part of it",
  ip: "Signup IP address, the whole value",
  fingerprint: "Device fingerprint, the whole value",
};

/**
 * Searches accounts by PII. The terms live in the address, so a search can
 * be shared and survives a reload. A user without `accounts.search_pii` sees
 * one line in place of the fields. Give it a `key` of the address's query
 * string, so that the fields follow the address.
 */
export function SearchForm(): ReactElement | null {
  const { user, can } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const [values, setValues] = useState<Readonly<Record<keyof SearchTerms, string>>>({
    email: searchParams.get("email") ?? "",
    ip: searchParams.get("ip") ?? "",
    fingerprint: searchParams.get("fingerprint") ?? "",
  });
  const [isRefused, setIsRefused] = useState(false);

  const hasTermsInAddress = searchTermNames.some((name) => searchParams.has(name));

  function applyTerms(terms: SearchTerms): void {
    const next = new URLSearchParams();
    const status = searchParams.get("status");
    if (status !== null) {
      next.set("status", status);
    }
    for (const name of searchTermNames) {
      const value = terms[name];
      if (value !== undefined) {
        next.set(name, value);
      }
    }
    setSearchParams(next);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const terms = parseSearchTerms(values);
    setIsRefused(terms === null);
    if (terms !== null) {
      applyTerms(terms);
    }
  }

  const clearButton = (
    <Button
      onClick={() => {
        applyTerms({});
      }}
    >
      Clear
    </Button>
  );

  if (user === null) {
    return null;
  }
  if (!can("accounts.search_pii")) {
    return (
      <div className="flex items-center gap-4">
        <p className="text-sm text-ink-muted">
          Your group, {staffGroupLabels[user.group_name]}, can filter by status only. Searching
          by email, IP address or fingerprint needs an analyst or an enforcer.
        </p>
        {hasTermsInAddress && clearButton}
      </div>
    );
  }
  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      role="search"
      aria-label="Search accounts"
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-6"
    >
      <div className="grid grid-cols-3 gap-4">
        {searchTermNames.map((name) => (
          <TextField
            key={name}
            label={fieldLabels[name]}
            name={name}
            value={values[name]}
            onChange={(event) => {
              setValues({ ...values, [name]: event.target.value });
            }}
          />
        ))}
      </div>
      {isRefused && (
        <p role="alert" className="text-sm text-risk-high">
          A search term needs 2 to 100 characters. Nothing was searched.
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary">
          Search
        </Button>
        {clearButton}
        <p className="text-sm text-ink-muted">
          Results match the full value, even though the list shows it masked.
        </p>
      </div>
    </form>
  );
}
