import { create_enforcement_handler } from "#app/lib/enforcement/run_enforcement.ts";

/**
 * `POST /api/accounts/:account_id/mark_spam`. Records when an account was
 * marked as spam. It leaves the status alone.
 */
export const mark_account_spam = create_enforcement_handler("mark_spam");
