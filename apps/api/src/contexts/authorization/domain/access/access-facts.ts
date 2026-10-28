// ============================================
// domain/access/access-facts.ts — what is known about the subject when deciding (ADR 067)
// ============================================
// Loaded once per decision by an infrastructure reader (Dependency Inversion:
// the domain declares the shape, the reader fills it), then handed to every
// allow path — no path ever queries the database for subject data itself.

import type { EpochMs, PermissionPair, PermissionResource, ShareLevel } from "@workspace/shared";

import type { StoreScope } from "./store-scope";

/** An extra permission given to one member (or platform user) on top of their role. */
export interface ActiveGrant {
	readonly permission: PermissionPair;
	/** The one store the grant is limited to; `null` = the whole tenant (or a platform grant). */
	readonly locationId: string | null;
	/** End of a temporary grant; `null` = permanent. */
	readonly expiresAt: EpochMs | null;
}

/** One record shared with the member. */
export interface ActiveShare {
	readonly resource: PermissionResource;
	readonly resourceId: string;
	readonly level: ShareLevel;
	readonly expiresAt: EpochMs | null;
}

/**
 * The subject's standing for one decision: the permissions of their role, the stores those
 * permissions reach, and their grants and shares. Every list holds live rows only (not deleted, of an
 * active membership); expiry is decided against the decision's `now`, never filtered in advance.
 */
export interface AccessFacts {
	readonly rolePermissions: readonly PermissionPair[];
	readonly stores: StoreScope;
	readonly grants: readonly ActiveGrant[];
	readonly shares: readonly ActiveShare[];
}

/** Whether a time-bounded row still applies at `now` (no end time: forever). */
export function isLiveAt(expiresAt: EpochMs | null, now: EpochMs): boolean {
	return expiresAt === null || now < expiresAt;
}
