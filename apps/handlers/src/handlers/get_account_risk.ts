import { account_id_param_schema } from "@trust-desk/shared";
import { error_response, json_response } from "#app/lib/http/json_response.ts";
import { current_mode_name } from "#app/lib/modes/present_mode.ts";
import { load_account_risk } from "#app/lib/risk/load_risk.ts";
import type { Handler } from "#app/types/handler.ts";

/**
 * `GET /api/accounts/:account_id/risk`. Scores one account and explains
 * the score.
 *
 * @returns 200 with the score, its band, all seven signals with the
 *   numbers behind them, and how many days came from the pre-aggregated
 *   table and how many from raw events. 404 when the id is malformed or
 *   matches no account.
 */
export const get_account_risk: Handler = async (_req, deps, context) => {
  const id = account_id_param_schema.safeParse(context.params["account_id"]);
  const account = id.success ? await deps.db.find_account_by_id(id.data) : null;

  if (account === null) {
    return error_response(
      404,
      "account_not_found",
      "No account has that id.",
      context.correlation_id,
    );
  }

  const risk = await load_account_risk(
    deps.db,
    account,
    await current_mode_name(deps.db),
    deps.clock.now(),
  );
  return json_response(risk, 200, context.correlation_id);
};
