import type { EpochMs } from "@workspace/shared";

/**
 * Closing a store takes its tills and credentials with it (migration plan §6.3, D27). Implemented by
 * pos (it owns `OrganizationTerminal` and `OrganizationApiKey`) and consumed by organizations through
 * its `STORE_CLOSURE_FACTORY` token, so organizations never imports pos (pos depends on organizations).
 */
export interface StoreClosureRequest {
	readonly organizationId: string;
	readonly locationId: string;
	readonly closedByUserId: string;
	readonly closedAt: EpochMs;
}

export interface StoreClosureResult {
	readonly terminalsRemoved: number;
	readonly apiKeysRevoked: number;
}

/** Bound to the caller's unit-of-work transaction, so the closure commits or rolls back as one unit. */
export interface StoreClosurePort {
	/** Soft-deletes the store's live terminals (clearing pairing codes) and revokes every live API key of the store or its terminals. */
	closeStore(request: StoreClosureRequest): Promise<StoreClosureResult>;
}
