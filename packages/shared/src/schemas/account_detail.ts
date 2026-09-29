import { z } from "zod";
import { account_schema } from "./account.ts";
import { enforcement_action_schema } from "./enforcement.ts";

/** Body of `GET /api/accounts/:account_id`. Actions are newest first. */
export const account_detail_response_schema = z.object({
  account: account_schema,
  enforcement_actions: z.array(enforcement_action_schema),
});
export type AccountDetailResponse = z.infer<typeof account_detail_response_schema>;
