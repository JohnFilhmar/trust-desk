import { audit_log_query_schema } from "@trust-desk/shared";
import type { AuditLogResponse } from "@trust-desk/shared";
import { error_response, json_response } from "#app/lib/http/json_response.ts";
import type { Handler } from "#app/types/handler.ts";

/**
 * `GET /api/audit_logs`. Lists who did what, newest first.
 *
 * @returns 200 with the rows, or 422 for a bad filter or limit.
 */
export const list_audit_logs: Handler = async (req, deps, context) => {
  const query = audit_log_query_schema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!query.success) {
    return error_response(
      422,
      "invalid_request",
      "The filter could not be read.",
      context.correlation_id,
    );
  }

  const body: AuditLogResponse = {
    items: await deps.db.list_audit_logs({
      account_id: query.data.account_id ?? null,
      limit: query.data.limit,
    }),
  };
  return json_response(body, 200, context.correlation_id);
};
