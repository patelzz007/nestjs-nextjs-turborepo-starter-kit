import type { Location } from "@prisma/client";
import { epochMs, type LocationResponse } from "@workspace/shared";

/** Maps a Prisma tenant location row to the API response shape. */
export function mapLocationToResponse(location: Location): LocationResponse {
	return {
		id: location.id,
		tenantId: location.tenantId,
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
