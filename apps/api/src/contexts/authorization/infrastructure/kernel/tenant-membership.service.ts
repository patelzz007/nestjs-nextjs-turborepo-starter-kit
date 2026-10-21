import { Inject, Injectable, Optional } from "@nestjs/common";

import { TenantLifecycleStateSchema, type MembershipStatus, type TenantLifecycleState } from "@workspace/shared";
import type { Prisma } from "@prisma/client";

import { RequestContextService } from "../../../../platform/infrastructure/context/request-context";
import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { AUTH_MEMBERSHIP_LOOKUP_OPERATION, SUPPORT_ACCESS_VERIFY_OPERATION } from "../../../../platform/application/shared-system-operations";
import { SERVED_TENANT_POLICY, type ServedTenantPolicy } from "../../../../platform/application/tenancy/served-tenant.port";

/** Tenant ids requested by a client (header, route, body) — never trusted as-is. */
export interface RequestedTenant {
	readonly tenantId?: string;
	readonly locationId?: string;
}

/** Tenant ids that were proven against the subject's active memberships. */
export interface VerifiedTenantContext {
	readonly tenantId?: string;
	readonly locationId?: string;
}

/**
 * The tenant a request targets — named by the route, or reached through a location — with its
 * lifecycle and the caller's access to it, so the lifecycle rule (C1) applies however the tenant was found.
 */
export interface TargetTenant {
	readonly tenantId: string;
	readonly lifecycleState: TenantLifecycleState;
	/**
	 * The caller's access: their membership row's status; `ACTIVE` for access through an approved
	 * support grant; `none` when they have no access at all.
	 */
	readonly membershipStatus: MembershipStatus | "none";
}

export interface TenantVerification {
	readonly context: VerifiedTenantContext;
	/** The targeted tenant, or null when the request targets none (or names one that is not live or not served). */
	readonly target: TargetTenant | null;
	/** Set when an approved, unexpired support grant stands in for a membership. */
	readonly supportAccessGrantId?: string;
	/** A requested tenant the subject is not an active member of. */
	readonly tenantRejected: boolean;
	/** A requested location outside the subject's membership location scope. */
	readonly locationRejected: boolean;
}

interface LocationScopeRow {
	readonly scopeType: "ALL_LOCATIONS" | "SELECTED";
	readonly locationId: string | null;
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
	flags: Pick<TenantVerification, "target" | "tenantRejected" | "locationRejected"> & Pick<TenantVerification, "supportAccessGrantId">,
): TenantVerification {
	return { context, ...flags };
}

/**
 * Relationship evaluator (ReBAC over relational tables):
 *
 *   user ─member→ tenant ─owns→ location
 *   membership ─location scope (with an optional location role)→ location
 *
 * Client-supplied tenant ids are only ever *requests*; this service decides
 * whether they are legitimate. Location access mirrors the database RLS
 * helper `app_can_access_location` (an explicit ALL_LOCATIONS or SELECTED
 * scope row is required). A tenant this deployment does not serve
 * (single mode: any tenant but `DEFAULT_TENANT_ID`) is never a target,
 * however the request reached it.
 */
@Injectable()
export class TenantMembershipService {
	public constructor(
		@Inject(TenantTransactionService) private readonly transactions: MembershipLookupTransactions,
		@Inject(SERVED_TENANT_POLICY) private readonly servedTenants: ServedTenantPolicy,
		@Optional() @Inject(RequestContextService) private readonly requestContext: RequestContextService | null = null,
	) {}

	public async verify(userId: string, requested: RequestedTenant): Promise<TenantVerification> {
		const { tenantId, locationId } = requested;
		const none = { target: null, tenantRejected: false, locationRejected: false };
		if (tenantId === undefined && locationId === undefined) {
			return verification({}, none);
		}
		const membership = await this.transactions.withSystemOperation(
			{ operation: AUTH_MEMBERSHIP_LOOKUP_OPERATION, reason: "Verify the tenant and location a request asked for", actorUserId: userId },
			(tx) => this.verifyOn(tx, userId, requested),
		);
		if (!membership.tenantRejected || tenantId === undefined || locationId !== undefined) {
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
		const { tenantId, locationId } = requested;
		const none = { target: null, tenantRejected: false, locationRejected: false };
		const locationTenantId = await this.resolveLocationTenantId(db, locationId);
		const targetTenantId = tenantId ?? locationTenantId;
		if (targetTenantId === null || !this.servedTenants.servesTenant(targetTenantId)) {
			return verification({}, { ...none, tenantRejected: tenantId !== undefined, locationRejected: locationId !== undefined });
		}

		const lifecycleState = await this.findLiveLifecycle(db, targetTenantId);
		if (lifecycleState === null) {
			return verification({}, { ...none, tenantRejected: true, locationRejected: locationId !== undefined });
		}
		const membership = await db.membership.findFirst({
			where: { userId, tenantId: targetTenantId, isDeleted: false },
			select: { status: true, locationScopes: { where: { isDeleted: false }, select: { scopeType: true, locationId: true } } },
		});
		const targetWith = (membershipStatus: TargetTenant["membershipStatus"]): TargetTenant => ({ tenantId: targetTenantId, lifecycleState, membershipStatus });
		if (membership === null) {
			return verification({}, { ...none, target: targetWith("none"), tenantRejected: true, locationRejected: locationId !== undefined });
		}
		if (membership.status !== "ACTIVE") {
			return verification({}, { ...none, target: targetWith(membership.status), tenantRejected: true, locationRejected: locationId !== undefined });
		}
		const target = targetWith("ACTIVE");

		if (locationId !== undefined && (locationTenantId !== targetTenantId || !coversLocation(membership.locationScopes, locationId))) {
			return verification({ tenantId: targetTenantId }, { ...none, target, locationRejected: true });
		}
		return verification({ tenantId: targetTenantId, ...(locationId === undefined ? {} : { locationId }) }, { ...none, target });
	}

	/** A live (not soft-deleted) tenant's lifecycle state, or null. */
	private async findLiveLifecycle(db: Prisma.TransactionClient, tenantId: string): Promise<TenantLifecycleState | null> {
		const tenant = await db.tenant.findFirst({ where: { id: tenantId, isDeleted: false }, select: { lifecycleState: true } });
		return tenant === null ? null : TenantLifecycleStateSchema.parse(tenant.lifecycleState);
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
