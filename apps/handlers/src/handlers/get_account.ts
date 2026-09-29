import { account_id_param_schema } from "@trust-desk/shared";
import type { AccountDetailResponse } from "@trust-desk/shared";
import { present_masked_account } from "#app/lib/accounts/present_account.ts";
import { error_response, json_response } from "#app/lib/http/json_response.ts";
import type { Handler } from "#app/types/handler.ts";

/**
 * `GET /api/accounts/:account_id`. Shows one account and what was done to it.
 *
 * @returns 200 with the masked account and its enforcement actions, or 404
 *   when the id is malformed or matches no account. Both give the same
 *   answer, so the response does not reveal which ids exist.
 */
export const get_account: Handler = async (_req, deps, context) => {
  const id = account_id_param_schema.safeParse(context.params["account_id"]);
  const row = id.success ? await deps.db.find_account_by_id(id.data) : null;

  if (row === null) {
    return error_response(
      404,
      "account_not_found",
      "No account has that id.",
      context.correlation_id,
    );
  }

  const body: AccountDetailResponse = {
    account: present_masked_account(row),
    enforcement_actions: await deps.db.list_enforcement_actions(row.id),
  };
  return json_response(body, 200, context.correlation_id);
};
