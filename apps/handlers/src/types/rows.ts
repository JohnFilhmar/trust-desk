import type { AccountStatus } from "@trust-desk/shared";
import type { z } from "zod";
import type {
  account_row_schema,
  staff_credentials_row_schema,
  staff_user_row_schema,
} from "#app/repositories/row_schemas.ts";

export type StaffUserRow = z.infer<typeof staff_user_row_schema>;
export type StaffCredentialsRow = z.infer<typeof staff_credentials_row_schema>;
export type AccountRow = z.infer<typeof account_row_schema>;

/** The position of the last row of a page. The next page starts after it. */
export type AccountCursor = {
  /** `created_at` exactly as MySQL wrote it, microseconds included. */
  created_at: string;
  id: number;
};

export type AccountSearchArgs = {
  status: AccountStatus | null;
  cursor: AccountCursor | null;
  /** How many rows to return at most. */
  limit: number;
};

export type AuditLogArgs = {
  account_id: number | null;
  limit: number;
};
