import { z } from "zod";

/** The three groups a staff user can belong to. */
export const staff_group_schema = z.enum(["viewer", "analyst", "enforcer"]);
export type StaffGroup = z.infer<typeof staff_group_schema>;

/** Every permission the console checks. Code checks a permission, never a group. */
export const permission_schema = z.enum([
  "accounts.read",
  "audit.read",
  "accounts.search_pii",
  "pii.reveal",
  "accounts.enforce",
  "accounts.bulk_enforce",
  "mode.change",
]);
export type Permission = z.infer<typeof permission_schema>;

/** The signed-in staff user, as the browser sees it. */
export const session_user_schema = z.object({
  id: z.number().int().positive(),
  email: z.email(),
  display_name: z.string().min(1),
  group_name: staff_group_schema,
  permissions: z.array(permission_schema),
});
export type SessionUser = z.infer<typeof session_user_schema>;

/** Body of `POST /api/login`. */
export const login_request_schema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});
export type LoginRequest = z.infer<typeof login_request_schema>;

/** Body of a successful `POST /api/login` and of `GET /api/session`. */
export const session_response_schema = z.object({
  user: session_user_schema,
});
export type SessionResponse = z.infer<typeof session_response_schema>;

/** One demo account shown on the login page. The password is public on purpose. */
export const demo_account_schema = z.object({
  email: z.email(),
  display_name: z.string().min(1),
  group_name: staff_group_schema,
});
export type DemoAccount = z.infer<typeof demo_account_schema>;
