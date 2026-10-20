import type { MerchantAccessGrant } from "../../../../platform/application/ports/authorization.port";

/**
 * Whether a row attributed to `locationId` (`null` = tenant-wide) lies within the caller's
 * granted stores. A tenant-wide row is outside any store-limited grant.
 */
export function isWithinGrant(grant: MerchantAccessGrant, locationId: string | null): boolean {
	if (grant.locationScope === "ALL_LOCATIONS") {
		return true;
	}
	return locationId !== null && grant.locationIds.includes(locationId);
}
