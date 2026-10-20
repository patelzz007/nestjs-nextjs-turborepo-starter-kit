import type { EpochMs } from "@workspace/shared";

/**
 * Closing a store takes its tills and credentials with it (migration plan §6.3, D27). Implemented by
 * pos (it owns `TenantTerminal` and `TenantApiKey`) and consumed by tenants through
 * its `STORE_CLOSURE_FACTORY` token, so tenants never imports pos (pos depends on tenants).
 */
export interface StoreClosureRequest {
	readonly tenantId: string;
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
