import type { DemoAccount } from "../schemas/staff.ts";

/**
 * The staff users every seed creates, one per group. The login page lists
 * them so a visitor can sign in with one click.
 */
export const demo_accounts: readonly DemoAccount[] = [
  { email: "viewer@example.com", display_name: "Demo Viewer", group_name: "viewer" },
  { email: "analyst@example.com", display_name: "Demo Analyst", group_name: "analyst" },
  { email: "enforcer@example.com", display_name: "Demo Enforcer", group_name: "enforcer" },
];

/** Public on purpose. This is a demo and every record in it is synthetic. */
export const demo_password = "trust-desk-demo-2026";
