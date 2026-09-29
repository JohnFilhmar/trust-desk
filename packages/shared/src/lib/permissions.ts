import type { Permission, StaffGroup } from "../schemas/staff.ts";

/**
 * What each group may do. Rails holds the same map in Ruby. Both are tested
 * against `fixtures/group_permissions.json`, so the two cannot drift.
 */
export const group_permissions: Readonly<Record<StaffGroup, readonly Permission[]>> = {
  viewer: ["accounts.read", "audit.read"],
  analyst: ["accounts.read", "audit.read", "accounts.search_pii", "pii.reveal"],
  enforcer: [
    "accounts.read",
    "audit.read",
    "accounts.search_pii",
    "pii.reveal",
    "accounts.enforce",
    "accounts.bulk_enforce",
    "mode.change",
  ],
};

/**
 * Lists the permissions of a group.
 *
 * @param group - The staff user's group.
 * @returns A new array, safe to put in a response.
 */
export function permissions_for(group: StaffGroup): Permission[] {
  return [...group_permissions[group]];
}

/**
 * Checks one permission.
 *
 * @param group - The staff user's group.
 * @param permission - What the code is about to do.
 * @returns `true` when the group holds the permission.
 */
export function has_permission(group: StaffGroup, permission: Permission): boolean {
  return group_permissions[group].includes(permission);
}
