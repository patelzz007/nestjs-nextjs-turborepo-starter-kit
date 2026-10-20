import {
	TenantAccessRequestStatusSchema,
	LocationStatusSchema,
	MembershipRoleSchema,
	MembershipStatusSchema,
	type TenantAccessRequestResponse,
	type LocationResponse,
	type MembershipResponse,
} from "@workspace/shared";

import type { AccessRequestState } from "../domain/aggregates/access-request.aggregate";
import type { PersistedLocation } from "../domain/repositories/location.repository";
import type { PersistedMembership } from "../domain/repositories/membership.repository";
import { LocationScope } from "../domain/value-objects/location-scope.value-object";

/** A stored location as the API returns it. */
export function toLocationResponse(location: PersistedLocation): LocationResponse {
	return {
		id: location.id,
		tenantId: location.tenantId,
		name: location.name,
		code: location.code,
		addressText: location.addressText,
		city: location.city,
		contactPhone: location.contactPhone,
		status: LocationStatusSchema.parse(location.status),
		rejectionReason: location.rejectionReason,
		isPrimary: location.isPrimary,
		createdAt: location.createdAt,
		updatedAt: location.updatedAt,
	};
}

/** A stored membership as the API returns it (fail-closed scope mapping). */
export function toMembershipResponse(membership: PersistedMembership): MembershipResponse {
	const scope = LocationScope.fromRows(membership.scopeRows);
	return {
		id: membership.id,
		tenantId: membership.tenantId,
		userId: membership.userId,
		role: MembershipRoleSchema.parse(membership.role),
		status: MembershipStatusSchema.parse(membership.status),
		displayName: membership.displayName,
		locationScopeType: scope.type,
		locationIds: [...scope.locationIds],
		createdAt: membership.createdAt,
		updatedAt: membership.updatedAt,
	};
}

/** A stored access request as the API returns it. */
export function toAccessRequestResponse(request: AccessRequestState): TenantAccessRequestResponse {
	return {
		id: request.id,
		tenantId: request.tenantId,
		userId: request.userId,
		status: TenantAccessRequestStatusSchema.parse(request.status),
		message: request.message,
		createdAt: request.createdAt,
	};
}
