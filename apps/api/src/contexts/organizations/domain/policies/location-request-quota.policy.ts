import { LocationRequestQuotaExceededError } from "../errors/organizations.errors";

/**
 * Store requests one organization may have waiting for review at once. Keeps
 * the admin review queue bounded; a merchant waits for a decision before
 * asking for more.
 */
export const MAX_PENDING_LOCATION_REQUESTS_PER_ORGANIZATION = 5;

/** Throws when another store request would exceed {@link MAX_PENDING_LOCATION_REQUESTS_PER_ORGANIZATION}. */
export function assertCanRequestLocation(pendingRequests: number): void {
	if (pendingRequests >= MAX_PENDING_LOCATION_REQUESTS_PER_ORGANIZATION) {
		throw new LocationRequestQuotaExceededError();
	}
}
