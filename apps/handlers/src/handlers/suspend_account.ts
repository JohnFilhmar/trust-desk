import { create_enforcement_handler } from "#app/lib/enforcement/run_enforcement.ts";

/** `POST /api/accounts/:account_id/suspend`. Moves an active account to suspended. */
export const suspend_account = create_enforcement_handler("suspend");
