import {
	OrganizationAccessRequestStatusSchema,
	OrganizationLocationStatusSchema,
	OrganizationMembershipRoleSchema,
	OrganizationMembershipStatusSchema,
	type OrganizationAccessRequestResponse,
	type OrganizationLocationResponse,
	type OrganizationMembershipResponse,
} from "@workspace/shared";

import type { AccessRequestState } from "../domain/aggregates/access-request.aggregate";
import type { PersistedLocation } from "../domain/repositories/location.repository";
import type { PersistedMembership } from "../domain/repositories/membership.repository";
import { LocationScope } from "../domain/value-objects/location-scope.value-object";

/** A stored location as the API returns it. */
export function toLocationResponse(location: PersistedLocation): OrganizationLocationResponse {
	return {
		id: location.id,
		organizationId: location.organizationId,
		name: location.name,
		code: location.code,
		addressText: location.addressText,
		city: location.city,
		contactPhone: location.contactPhone,
		status: OrganizationLocationStatusSchema.parse(location.status),
		rejectionReason: location.rejectionReason,
		isPrimary: location.isPrimary,
		createdAt: location.createdAt,
		updatedAt: location.updatedAt,
	};
}

/** A stored membership as the API returns it (fail-closed scope mapping). */
export function toMembershipResponse(membership: PersistedMembership): OrganizationMembershipResponse {
	const scope = LocationScope.fromRows(membership.scopeRows);
	return {
		id: membership.id,
		organizationId: membership.organizationId,
		userId: membership.userId,
		role: OrganizationMembershipRoleSchema.parse(membership.role),
		status: OrganizationMembershipStatusSchema.parse(membership.status),
		displayName: membership.displayName,
		locationScopeType: scope.type,
		locationIds: [...scope.locationIds],
		createdAt: membership.createdAt,
		updatedAt: membership.updatedAt,
	};
}

/** A stored access request as the API returns it. */
export function toAccessRequestResponse(request: AccessRequestState): OrganizationAccessRequestResponse {
	return {
		id: request.id,
		organizationId: request.organizationId,
		userId: request.userId,
		status: OrganizationAccessRequestStatusSchema.parse(request.status),
		message: request.message,
		createdAt: request.createdAt,
	};
}
