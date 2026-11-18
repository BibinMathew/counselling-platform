export const PROFILE_ROLES = ["customer", "counselor", "admin"] as const;

export type ProfileRole = (typeof PROFILE_ROLES)[number];

export function isProfileRoleAllowed(
  role: ProfileRole | null,
  allowedRoles: readonly ProfileRole[],
) {
  return role !== null && allowedRoles.includes(role);
}
