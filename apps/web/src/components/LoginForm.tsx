import { login_request_schema } from "@trust-desk/shared";
import type { LoginRequest } from "@trust-desk/shared";
import { useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

/** Props of `LoginForm`. */
export type LoginFormProps = {
  /** Runs with credentials that fit the contract. Credentials that do not fit never reach it. */
  onSubmit: (credentials: LoginRequest) => void;
  /** Disables the button while a sign-in runs. */
  isBusy: boolean;
};

/**
 * Asks for an email and a password, and checks both against the contract
 * before handing them on.
 *
 * @param props - See `LoginFormProps`.
 */
export function LoginForm({ onSubmit, isBusy }: LoginFormProps): ReactElement {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRefused, setIsRefused] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const credentials = login_request_schema.safeParse({ email, password });
    setIsRefused(!credentials.success);
    if (credentials.success) {
      onSubmit(credentials.data);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby="sign-in-heading"
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-6"
    >
      <h2 id="sign-in-heading" className="text-lg font-semibold">
        Staff sign in
      </h2>
      <TextField
        label="Email"
        type="email"
        name="email"
        autoComplete="username"
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
        }}
      />
      <TextField
        label="Password"
        type="password"
        name="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
        }}
      />
      {isRefused && (
        <p role="alert" className="text-sm text-risk-high">
          Enter an email address and a password.
        </p>
      )}
      <div>
        <Button type="submit" variant="primary" disabled={isBusy}>
          {isBusy ? "Signing in" : "Sign in"}
        </Button>
      </div>
    </form>
  );
}
