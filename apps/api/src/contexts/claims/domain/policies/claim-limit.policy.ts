import { ClaimLimitReachedError } from "../errors/claims.errors";

/** A customer may hold at most `maxClaimsPerUser` live claims of one reward (`null` = unlimited). */
export function assertWithinClaimLimit(heldClaims: number, maxClaimsPerUser: number | null): void {
	if (maxClaimsPerUser !== null && heldClaims >= maxClaimsPerUser) {
		throw new ClaimLimitReachedError(maxClaimsPerUser);
	}
}
