import { create_enforcement_handler } from "#app/lib/enforcement/run_enforcement.ts";

/**
 * `POST /api/accounts/:account_id/unsuspend`. Moves a suspended account
 * back to active. Rails refuses it while the console is in lockdown.
 */
export const unsuspend_account = create_enforcement_handler("unsuspend");
