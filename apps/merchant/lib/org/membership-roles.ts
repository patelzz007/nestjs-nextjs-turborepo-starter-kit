import type { OrganizationMembershipRole } from "@workspace/shared";

/**
 * Organization actions the API guards by membership role rather than by a
 * RewardHub capability. Kept in lockstep with the API services:
 * - team roster / invites: `OrganizationMembershipService.assertCanManageTeam` (OWNER, ADMIN)
 * - store locations: `OrganizationLocationService.assertCanManageLocations` (OWNER, ADMIN)
 * - KYB submission: `MerchantContextService.requireOwnerRole` (OWNER)
 */
const TEAM_MANAGER_ROLES: readonly OrganizationMembershipRole[] = ["OWNER", "ADMIN"];
const LOCATION_MANAGER_ROLES: readonly OrganizationMembershipRole[] = ["OWNER", "ADMIN"];
const KYB_SUBMITTER_ROLES: readonly OrganizationMembershipRole[] = ["OWNER"];

export type MerchantRoleAction = "manageTeam" | "manageLocations" | "submitKyb";

const ROLE_ACTION_RULES: Readonly<Record<MerchantRoleAction, readonly OrganizationMembershipRole[]>> = {
	manageTeam: TEAM_MANAGER_ROLES,
	manageLocations: LOCATION_MANAGER_ROLES,
	submitKyb: KYB_SUBMITTER_ROLES,
};

/** True when `role` may perform `action` (fails closed without a membership). */
export function membershipRoleAllows(role: OrganizationMembershipRole | undefined, action: MerchantRoleAction): boolean {
	return role !== undefined && ROLE_ACTION_RULES[action].includes(role);
}
