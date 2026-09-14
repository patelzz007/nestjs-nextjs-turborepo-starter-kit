import type { OrganizationLocation } from "@prisma/client";
import { epochMs, type OrganizationLocationResponse } from "@workspace/shared";

/** Maps a Prisma organization location row to the API response shape. */
export function mapOrganizationLocationToResponse(location: OrganizationLocation): OrganizationLocationResponse {
	return {
		id: location.id,
		organizationId: location.organizationId,
		name: location.name,
		code: location.code,
		addressText: location.addressText,
		city: location.city,
		contactPhone: location.contactPhone,
		status: location.status,
		rejectionReason: location.rejectionReason,
		isPrimary: location.isPrimary,
		createdAt: epochMs(Number(location.createdAt)),
		updatedAt: epochMs(Number(location.updatedAt)),
	};
}
