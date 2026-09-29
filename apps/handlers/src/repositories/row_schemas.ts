import { account_status_schema, staff_group_schema } from "@trust-desk/shared";
import { z } from "zod";

/**
 * A `datetime(6)` column as the driver returns it with `dateStrings` on,
 * turned into UTC ISO 8601. MySQL holds UTC, so the `Z` is a fact, not a guess.
 */
export const mysql_datetime_schema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/)
  .transform((value) => `${value.replace(" ", "T")}Z`);

/** A staff user without the password hash. */
export const staff_user_row_schema = z.object({
  id: z.number().int().positive(),
  email: z.string(),
  display_name: z.string(),
  group_name: staff_group_schema,
});

/** A staff user with the bcrypt hash. Used by login and nowhere else. */
export const staff_credentials_row_schema = staff_user_row_schema.extend({
  password_digest: z.string().min(1),
});

/** An account as stored, with raw PII. It never leaves the service in this form. */
export const account_row_schema = z.object({
  id: z.number().int().positive(),
  email: z.string(),
  status: account_status_schema,
  plan: z.string(),
  spam_marked_at: mysql_datetime_schema.nullable(),
  created_at: mysql_datetime_schema,
  // The keyset cursor needs the value exactly as MySQL wrote it.
  created_at_raw: z.string(),
  // The driver parses a JSON column before the row reaches this schema.
  signup_context: z.object({
    ip: z.string(),
    country: z.string(),
    user_agent: z.string(),
    device_fingerprint: z.string(),
    referral: z.string().nullable(),
  }),
});
