import { Inject, Injectable, Optional } from "@nestjs/common";

import { TenantLifecycleStateSchema, type MembershipStatus, type TenantLifecycleState } from "@workspace/shared";
import type { Prisma } from "@prisma/client";

import { RequestContextService } from "../../../../platform/infrastructure/context/request-context";
import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { AUTH_MEMBERSHIP_LOOKUP_OPERATION, SUPPORT_ACCESS_VERIFY_OPERATION } from "../../../../platform/application/shared-system-operations";

/** Tenant ids requested by a client (header, route, body) — never trusted as-is. */
export interface RequestedTenant {
	readonly tenantId?: string;
	readonly storeId?: string;
	readonly locationId?: string;
}

/** Tenant ids that were proven against the subject's active memberships. */
export interface VerifiedTenantContext {
	readonly tenantId?: string;
	readonly storeId?: string;
	readonly locationId?: string;
}

/**
 * The tenant a request targets — named by the route, or reached through a store or location — with its
 * lifecycle and the caller's access to it, so the lifecycle rule (C1) applies however the tenant was found.
 */
export interface TargetTenant {
	readonly tenantId: string;
	readonly lifecycleState: TenantLifecycleState;
	/**
	 * The caller's access: their membership row's status; `ACTIVE` for access through an active store
	 * membership or an approved support grant; `none` when they have no access at all.
	 */
	readonly membershipStatus: MembershipStatus | "none";
}

export interface TenantVerification {
	readonly context: VerifiedTenantContext;
	/** The targeted tenant, or null when the request targets none (or names one that is not live). */
	readonly target: TargetTenant | null;
	/** Set when an approved, unexpired support grant stands in for a membership. */
	readonly supportAccessGrantId?: string;
	/** A requested tenant the subject is not an active member of. */
	readonly tenantRejected: boolean;
	/** A requested store the subject cannot act in (no membership, other org, inactive). */
	readonly storeRejected: boolean;
	/** A requested location outside the subject's membership location scope. */
	readonly locationRejected: boolean;
}

interface LocationScopeRow {
	readonly scopeType: "ALL_LOCATIONS" | "SELECTED";
	readonly locationId: string | null;
}

interface ActiveStore {
	readonly id: string;
	readonly tenantId: string;
	readonly locationId: string;
}

function coversLocation(scopes: readonly LocationScopeRow[], locationId: string): boolean {
	return scopes.some((scope) => scope.scopeType === "ALL_LOCATIONS" || scope.locationId === locationId);
}

/** Membership checks the guard runs before the handler's RLS scope exists. */
interface MembershipLookupTransactions {
	withSystemOperation<TResult>(context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

function verification(
	context: VerifiedTenantContext,
	flags: Pick<TenantVerification, "target" | "tenantRejected" | "storeRejected" | "locationRejected"> & Pick<TenantVerification, "supportAccessGrantId">,
): TenantVerification {
	return { context, ...flags };
}

/**
 * Relationship evaluator (ReBAC over relational tables):
 *
 *   user ─member→ tenant ─owns→ store ─operates at→ location
 *   user ─store member→ store
 *
 * Client-supplied tenant ids are only ever *requests*; this service decides
 * whether they are legitimate. Location access mirrors the database RLS
 * helper `app_can_access_location` (an explicit ALL_LOCATIONS or SELECTED
 * scope row is required). A store is accessible through an active store
 * membership, or through a tenant membership whose location scope
 * covers the store's location.
 */
@Injectable()
export class TenantMembershipService {
	public constructor(
		@Inject(TenantTransactionService) private readonly transactions: MembershipLookupTransactions,
		@Optional() @Inject(RequestContextService) private readonly requestContext: RequestContextService | null = null,
	) {}

	public async verify(userId: string, requested: RequestedTenant): Promise<TenantVerification> {
		const { tenantId, storeId, locationId } = requested;
		const none = { target: null, tenantRejected: false, storeRejected: false, locationRejected: false };
		if (tenantId === undefined && storeId === undefined && locationId === undefined) {
			return verification({}, none);
		}
		const membership = await this.transactions.withSystemOperation(
			{ operation: AUTH_MEMBERSHIP_LOOKUP_OPERATION, reason: "Verify the tenant, store, and location a request asked for", actorUserId: userId },
			(tx) => this.verifyOn(tx, userId, requested),
		);
		if (!membership.tenantRejected || tenantId === undefined || storeId !== undefined || locationId !== undefined) {
			return membership;
		}
		const grantId = await this.activeSupportGrantId(userId, tenantId);
		if (grantId === null || membership.target === null) {
			return membership;
		}
		this.requestContext?.bindSupportAccessGrant(grantId);
		return verification({ tenantId }, { ...none, target: { ...membership.target, membershipStatus: "ACTIVE" }, supportAccessGrantId: grantId });
	}

	/** An approved grant for this user and tenant, or null. Read under `support_access.verify`. */
	private async activeSupportGrantId(userId: string, tenantId: string): Promise<string | null> {
		const now = BigInt(Date.now());
		const grant = await this.transactions.withSystemOperation(
			{ operation: SUPPORT_ACCESS_VERIFY_OPERATION, reason: "Read an approved support grant for a platform user without a membership", actorUserId: userId },
			(tx) =>
				tx.supportAccessGrant.findFirst({
					where: { supportUserId: userId, tenantId, status: "ACTIVE", isDeleted: false, revokedAt: null, expiresAt: { gt: now } },
					select: { id: true },
				}),
		);
		return grant?.id ?? null;
	}

	private async verifyOn(db: Prisma.TransactionClient, userId: string, requested: RequestedTenant): Promise<TenantVerification> {
		const { tenantId, storeId, locationId } = requested;
		const none = { target: null, tenantRejected: false, storeRejected: false, locationRejected: false };
		const store = storeId === undefined ? null : await this.findActiveStore(db, storeId);
		if (storeId !== undefined && store === null) {
			return verification({}, { ...none, storeRejected: true, locationRejected: locationId !== undefined });
		}

		const targetTenantId = tenantId ?? store?.tenantId ?? (await this.resolveLocationTenantId(db, locationId));
		if (targetTenantId === null) {
			return verification({}, { ...none, tenantRejected: tenantId !== undefined, storeRejected: storeId !== undefined, locationRejected: locationId !== undefined });
		}

		const lifecycleState = await this.findLiveLifecycle(db, targetTenantId);
		if (lifecycleState === null) {
			return verification({}, { ...none, tenantRejected: true, storeRejected: storeId !== undefined, locationRejected: locationId !== undefined });
		}
		const membership = await db.membership.findFirst({
			where: { userId, tenantId: targetTenantId, isDeleted: false },
			select: { status: true, locationScopes: { where: { isDeleted: false }, select: { scopeType: true, locationId: true } } },
		});
		const targetWith = (membershipStatus: TargetTenant["membershipStatus"]): TargetTenant => ({ tenantId: targetTenantId, lifecycleState, membershipStatus });
		if (membership !== null && membership.status !== "ACTIVE") {
			return verification(
				{},
				{ ...none, target: targetWith(membership.status), tenantRejected: true, storeRejected: storeId !== undefined, locationRejected: locationId !== undefined },
			);
		}
		const storeMembership =
			store === null
				? null
				: await db.storeMembership.findFirst({
						where: { userId, storeId: store.id, status: "ACTIVE", isDeleted: false },
						select: { id: true },
					});

		// Store members without a tenant membership are anchored to their store's tenant.
		if (membership === null && (storeMembership === null || store?.tenantId !== targetTenantId)) {
			return verification({}, { ...none, target: targetWith("none"), tenantRejected: true, storeRejected: storeId !== undefined, locationRejected: locationId !== undefined });
		}
		// An active tenant membership, or (for a store member) an active store membership in this tenant.
		const target = targetWith("ACTIVE");

		let verifiedStoreId: string | undefined;
		if (store !== null) {
			const viaTenant = membership !== null && coversLocation(membership.locationScopes, store.locationId);
			if (store.tenantId !== targetTenantId || (storeMembership === null && !viaTenant)) {
				return verification({ tenantId: targetTenantId }, { ...none, target, storeRejected: true, locationRejected: locationId !== undefined });
			}
			verifiedStoreId = store.id;
		}

		let verifiedLocationId: string | undefined;
		if (locationId !== undefined) {
			const locationBelongsToTenant = (await this.resolveLocationTenantId(db, locationId)) === targetTenantId;
			const locationInScope = membership === null ? store?.locationId === locationId : coversLocation(membership.locationScopes, locationId);
			if (!locationBelongsToTenant || !locationInScope) {
				return verification({ tenantId: targetTenantId, ...(verifiedStoreId === undefined ? {} : { storeId: verifiedStoreId }) }, { ...none, target, locationRejected: true });
			}
			verifiedLocationId = locationId;
		}

		return verification(
			{
				tenantId: targetTenantId,
				...(verifiedStoreId === undefined ? {} : { storeId: verifiedStoreId }),
				...(verifiedLocationId === undefined ? {} : { locationId: verifiedLocationId }),
			},
			{ ...none, target },
		);
	}

	/** A live (not soft-deleted) tenant's lifecycle state, or null. */
	private async findLiveLifecycle(db: Prisma.TransactionClient, tenantId: string): Promise<TenantLifecycleState | null> {
		const tenant = await db.tenant.findFirst({ where: { id: tenantId, isDeleted: false }, select: { lifecycleState: true } });
		return tenant === null ? null : TenantLifecycleStateSchema.parse(tenant.lifecycleState);
	}

	private async findActiveStore(db: Prisma.TransactionClient, storeId: string): Promise<ActiveStore | null> {
		return db.store.findFirst({
			where: { id: storeId, isDeleted: false, status: "ACTIVE" },
			select: { id: true, tenantId: true, locationId: true },
		});
	}

	private async resolveLocationTenantId(db: Prisma.TransactionClient, locationId: string | undefined): Promise<string | null> {
		if (locationId === undefined) {
			return null;
		}
		const location = await db.location.findFirst({
			where: { id: locationId, isDeleted: false },
			select: { tenantId: true },
		});
		return location?.tenantId ?? null;
	}
}
