import type { Deps } from "#app/interfaces/deps.ts";

/** Values worked out for one request before its handler runs. */
export type RequestContext = {
  correlation_id: string;
  /** Values captured from the path, such as `account_id` from `/api/accounts/:account_id`. */
  params: Record<string, string>;
};

/**
 * The shape of every endpoint. It uses the web-standard Request and Response,
 * so the same function runs behind the Node adapter and on AWS Lambda.
 */
export type Handler = (
  req: Request,
  deps: Deps,
  context: RequestContext,
) => Promise<Response>;
