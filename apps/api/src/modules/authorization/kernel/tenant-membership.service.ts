import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";

/** Tenant ids requested by a client (header, route, body) — never trusted as-is. */
export interface RequestedTenant {
	readonly organizationId?: string;
	readonly storeId?: string;
	readonly locationId?: string;
}

/** Tenant ids that were proven against the subject's active memberships. */
export interface VerifiedTenantContext {
	readonly organizationId?: string;
	readonly storeId?: string;
	readonly locationId?: string;
}

export interface TenantVerification {
	readonly context: VerifiedTenantContext;
	/** A requested organization the subject is not an active member of. */
	readonly organizationRejected: boolean;
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
	readonly organizationId: string;
	readonly locationId: string;
}

function coversLocation(scopes: readonly LocationScopeRow[], locationId: string): boolean {
	return scopes.some((scope) => scope.scopeType === "ALL_LOCATIONS" || scope.locationId === locationId);
}

function verification(context: VerifiedTenantContext, flags: Pick<TenantVerification, "organizationRejected" | "storeRejected" | "locationRejected">): TenantVerification {
	return { context, ...flags };
}

/**
 * Relationship evaluator (ReBAC over relational tables):
 *
 *   user ─member→ organization ─owns→ store ─operates at→ location
 *   user ─store member→ store
 *
 * Client-supplied tenant ids are only ever *requests*; this service decides
 * whether they are legitimate. Location access mirrors the database RLS
 * helper `app_can_access_location` (an explicit ALL_LOCATIONS or SELECTED
 * scope row is required). A store is accessible through an active store
 * membership, or through an organization membership whose location scope
 * covers the store's location.
 */
@Injectable()
export class TenantMembershipService {
	public constructor(private readonly prisma: PrismaService) {}

	public async verify(userId: string, requested: RequestedTenant): Promise<TenantVerification> {
		const { organizationId, storeId, locationId } = requested;
		const none = { organizationRejected: false, storeRejected: false, locationRejected: false };
		if (organizationId === undefined && storeId === undefined && locationId === undefined) {
			return verification({}, none);
		}

		const store = storeId === undefined ? null : await this.findActiveStore(storeId);
		if (storeId !== undefined && store === null) {
			return verification({}, { ...none, storeRejected: true, locationRejected: locationId !== undefined });
		}

		const targetOrganizationId = organizationId ?? store?.organizationId ?? (await this.resolveLocationOrganizationId(locationId));
		if (targetOrganizationId === null) {
			return verification({}, { organizationRejected: organizationId !== undefined, storeRejected: storeId !== undefined, locationRejected: locationId !== undefined });
		}

		const membership = await this.prisma.organizationMembership.findFirst({
			where: { userId, organizationId: targetOrganizationId, status: "ACTIVE", isDeleted: false, organization: { isDeleted: false } },
			select: { locationScopes: { select: { scopeType: true, locationId: true } } },
		});
		const storeMembership =
			store === null
				? null
				: await this.prisma.storeMembership.findFirst({
						where: { userId, storeId: store.id, status: "ACTIVE", isDeleted: false },
						select: { id: true },
					});

		// Store members without an organization membership are anchored to their store's organization.
		if (membership === null && (storeMembership === null || store?.organizationId !== targetOrganizationId)) {
			return verification({}, { organizationRejected: true, storeRejected: storeId !== undefined, locationRejected: locationId !== undefined });
		}

		let verifiedStoreId: string | undefined;
		if (store !== null) {
			const viaOrganization = membership !== null && coversLocation(membership.locationScopes, store.locationId);
			if (store.organizationId !== targetOrganizationId || (storeMembership === null && !viaOrganization)) {
				return verification({ organizationId: targetOrganizationId }, { ...none, storeRejected: true, locationRejected: locationId !== undefined });
			}
			verifiedStoreId = store.id;
		}

		let verifiedLocationId: string | undefined;
		if (locationId !== undefined) {
			const locationBelongsToOrganization = (await this.resolveLocationOrganizationId(locationId)) === targetOrganizationId;
			const locationInScope = membership === null ? store?.locationId === locationId : coversLocation(membership.locationScopes, locationId);
			if (!locationBelongsToOrganization || !locationInScope) {
				return verification(
					{ organizationId: targetOrganizationId, ...(verifiedStoreId === undefined ? {} : { storeId: verifiedStoreId }) },
					{ ...none, locationRejected: true },
				);
			}
			verifiedLocationId = locationId;
		}

		return verification(
			{
				organizationId: targetOrganizationId,
				...(verifiedStoreId === undefined ? {} : { storeId: verifiedStoreId }),
				...(verifiedLocationId === undefined ? {} : { locationId: verifiedLocationId }),
			},
			none,
		);
	}

	private async findActiveStore(storeId: string): Promise<ActiveStore | null> {
		return this.prisma.store.findFirst({
			where: { id: storeId, isDeleted: false, status: "ACTIVE" },
			select: { id: true, organizationId: true, locationId: true },
		});
	}

	private async resolveLocationOrganizationId(locationId: string | undefined): Promise<string | null> {
		if (locationId === undefined) {
			return null;
		}
		const location = await this.prisma.organizationLocation.findFirst({
			where: { id: locationId, isDeleted: false },
			select: { organizationId: true },
		});
		return location?.organizationId ?? null;
	}
}
