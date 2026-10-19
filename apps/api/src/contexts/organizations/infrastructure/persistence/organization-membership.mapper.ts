import type { OrganizationMembership, OrganizationMembershipLocationScope, User } from "@prisma/client";
import { epochMs, type OrganizationMemberRosterResponse, type OrganizationMembershipResponse } from "@workspace/shared";

type MembershipWithScopes = OrganizationMembership & {
	readonly locationScopes: readonly OrganizationMembershipLocationScope[];
};

type MembershipWithUser = MembershipWithScopes & {
	readonly user: Pick<User, "email" | "fullName">;
};

export function mapMembershipLocationScope(membership: MembershipWithScopes): {
	readonly locationScopeType: OrganizationMembershipResponse["locationScopeType"];
	readonly locationIds: string[];
} {
	// Fail closed: only explicit ALL_LOCATIONS rows (and no SELECTED rows) grant
	// every store. No rows — or any SELECTED row — means exactly the listed
	// stores, so a membership with no scope rows reaches no store at all.
	const locationIds = membership.locationScopes.flatMap((scope) => (scope.scopeType === "SELECTED" && scope.locationId !== null ? [scope.locationId] : []));
	const hasSelectedRow = membership.locationScopes.some((scope) => scope.scopeType === "SELECTED");
	const hasAllLocationsRow = membership.locationScopes.some((scope) => scope.scopeType === "ALL_LOCATIONS");
	const locationScopeType: OrganizationMembershipResponse["locationScopeType"] = hasAllLocationsRow && !hasSelectedRow ? "ALL_LOCATIONS" : "SELECTED";

	return { locationScopeType, locationIds };
}

export function mapMembershipToResponse(membership: MembershipWithScopes): OrganizationMembershipResponse {
	const { locationScopeType, locationIds } = mapMembershipLocationScope(membership);

	return {
		id: membership.id,
		organizationId: membership.organizationId,
		userId: membership.userId,
		role: membership.role,
		status: membership.status,
		displayName: membership.displayName,
		locationScopeType,
		locationIds,
		createdAt: epochMs(Number(membership.createdAt)),
		updatedAt: epochMs(Number(membership.updatedAt)),
	};
}

export function mapMembershipToRosterResponse(membership: MembershipWithUser): OrganizationMemberRosterResponse {
	const base = mapMembershipToResponse(membership);

	return {
		...base,
		email: membership.user.email,
		fullName: membership.user.fullName,
	};
}
