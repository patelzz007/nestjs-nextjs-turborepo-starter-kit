// ============================================
// domain/access/allow-paths.ts — the four ways a request can be allowed (ADR 067)
// ============================================
// Design patterns:
//   - STRATEGY: each path is one implementation of `AllowPath`; `AccessDecider`
//     holds a list of them and never knows which is which.
//   - Open/Closed: a fifth path is a new class added to the decider's list —
//     no existing path or the decider changes.
//   - Single Responsibility: each class answers exactly one question.
//   - Dependency Inversion: ownership is read through the `RecordOwnership`
//     interface declared here; the database lookup lives in infrastructure.

import { permissionSatisfies, type EpochMs, type PermissionPair } from "@workspace/shared";

import type { AccessFacts } from "./access-facts";
import { isLiveAt } from "./access-facts";
import { OWNERSHIP_ACTIONS, SHARE_LEVEL_ACTIONS, type AccessRequest, type AllowPathName } from "./access-request";

/** One way a request can be allowed. */
export interface AllowPath {
	readonly name: AllowPathName;
	allows(request: AccessRequest, facts: AccessFacts, now: EpochMs): Promise<boolean>;
}

/** Who owns a record (`null`: no such record, or the type has no owner). Read from the database, never the request. */
export interface RecordOwnership {
	ownerOf(resource: AccessRequest["permission"]["resource"], resourceId: string): Promise<string | null>;
}

/** A held permission covers the required one: the same verb on the same resource. */
function holds(held: PermissionPair, required: PermissionPair): boolean {
	return permissionSatisfies(held, required);
}

/** The role's permissions, inside the member's stores. */
export class RoleAllowPath implements AllowPath {
	public readonly name = "role" satisfies AllowPathName;

	public allows(request: AccessRequest, facts: AccessFacts): Promise<boolean> {
		const inScope = facts.stores.covers(request.target?.locationId);
		return Promise.resolve(inScope && facts.rolePermissions.some((held) => holds(held, request.permission)));
	}
}

/**
 * An extra permission, unexpired at `now`. Its scope is the grant's store (or the whole tenant)
 * INTERSECTED with the member's stores: a grant for a store the member no longer covers is inert,
 * and works again when the store is added back. A store-limited grant never satisfies a record that
 * has no store.
 */
export class GrantAllowPath implements AllowPath {
	public readonly name = "grant" satisfies AllowPathName;

	public allows(request: AccessRequest, facts: AccessFacts, now: EpochMs): Promise<boolean> {
		const locationId = request.target?.locationId;
		const allowed =
			facts.stores.covers(locationId) &&
			facts.grants.some(
				(grant) =>
					isLiveAt(grant.expiresAt, now) &&
					holds(grant.permission, request.permission) &&
					(grant.locationId === null || (locationId !== undefined && grant.locationId === locationId)),
			);
		return Promise.resolve(allowed);
	}
}

/** One record shared with the member: VIEW reads it, EDIT reads and updates it — nothing else, nowhere else. */
export class ShareAllowPath implements AllowPath {
	public readonly name = "share" satisfies AllowPathName;

	public allows(request: AccessRequest, facts: AccessFacts, now: EpochMs): Promise<boolean> {
		const target = request.target;
		if (target?.resourceId === undefined || target.resource !== request.permission.resource) {
			return Promise.resolve(false);
		}
		const resourceId = target.resourceId;
		return Promise.resolve(
			facts.shares.some(
				(share) =>
					share.resource === target.resource &&
					share.resourceId === resourceId &&
					isLiveAt(share.expiresAt, now) &&
					SHARE_LEVEL_ACTIONS[share.level].includes(request.permission.action),
			),
		);
	}
}

/**
 * The one implicit path: the owner of a record may read and update THAT record — never delete it,
 * never a lifecycle verb, never another record (ADR 067).
 */
export class OwnershipAllowPath implements AllowPath {
	public readonly name = "ownership" satisfies AllowPathName;

	public constructor(private readonly ownership: RecordOwnership) {}

	public async allows(request: AccessRequest): Promise<boolean> {
		const target = request.target;
		if (target?.resourceId === undefined || target.resource !== request.permission.resource || !OWNERSHIP_ACTIONS.includes(request.permission.action)) {
			return false;
		}
		return (await this.ownership.ownerOf(target.resource, target.resourceId)) === request.userId;
	}
}
