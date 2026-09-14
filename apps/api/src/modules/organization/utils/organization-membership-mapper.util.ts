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
	const locationScopeType = membership.locationScopes.length === 0 ? "ALL_LOCATIONS" : membership.locationScopes[0].scopeType;
	const locationIds = membership.locationScopes.flatMap((scope) => (scope.locationId === null ? [] : [scope.locationId]));

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
