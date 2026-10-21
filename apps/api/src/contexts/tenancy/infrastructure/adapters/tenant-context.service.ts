import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { LIST_SLOT_INDEX, epochMs, IanaTimeZoneSchema, UuidParamSchema, type TenantContextResponse, type MembershipResponse } from "@workspace/shared";

import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { CEDAR_POLICY_EVALUATOR, type CedarPolicyEvaluatorPort } from "../../../authorization/public-api";
import { mapLocationToResponse } from "../persistence/tenant-location.mapper";
import { mapTenantLogo, TENANT_LOGO_ASSETS_SELECT } from "../persistence/tenant-logo";
import { mapMembershipToResponse } from "../persistence/tenant-membership.mapper";
import { TenantAuditService } from "../audit/tenant-audit.adapter";
import { PublicUrlResolver } from "../../../../config/public-url.resolver";

export interface ResolvedTenantContext {
	readonly tenantId: string;
	readonly slug: string;
	readonly displayName: string;
	readonly userId: string;
	readonly membership: MembershipResponse;
	readonly policyVersion: number;
}

@Injectable()
export class TenantContextService {
	public constructor(
		private readonly tenantTx: TenantTransactionService,
		@Inject(CEDAR_POLICY_EVALUATOR) private readonly cedar: CedarPolicyEvaluatorPort,
		private readonly audit: TenantAuditService,
		private readonly publicUrls: PublicUrlResolver,
	) {}

	/** Resolve slug or tenant id → tenant id for pre-membership flows (uniform not-found). */
	public async resolveTenantIdBySlug(routeKey: string): Promise<string> {
		const org = await this.tenantTx.withSystemOperation(
			{
				operation: "tenant.context.resolve_route_key",
				reason: "Resolve tenant route key",
				actorUserId: null,
			},
			async (tx) =>
				tx.tenant.findFirst({
					where: this.buildActiveTenantWhere(routeKey),
					select: { id: true },
				}),
		);
		if (org === null) {
			throw new NotFoundException();
		}
		return org.id;
	}

	/**
	 * Resolve slug or tenant id → tenant; uniform not-found for a
	 * missing tenant AND for a non-member (no existence oracle). Any other
	 * failure (database down, policy load error) propagates as itself — it is
	 * never disguised as a 404.
	 */
	public async resolveBySlug(userId: string, routeKey: string): Promise<ResolvedTenantContext> {
		const row = await this.tenantTx.withSystemOperation(
			{
				operation: "tenant.context.resolve_route_key",
				reason: "Resolve tenant route key for URL context",
				actorUserId: userId,
			},
			async (tx) =>
				tx.tenant.findFirst({
					where: this.buildActiveTenantWhere(routeKey),
					include: {
						memberships: {
							where: { userId, status: "ACTIVE", isDeleted: false },
							include: { locationScopes: { where: { isDeleted: false } } },
						},
					},
				}),
		);

		const membership = row?.memberships[LIST_SLOT_INDEX.first];
		if (row === null || membership === undefined) {
			throw new NotFoundException();
		}

		const policyVersion = await this.cedar.getActivePolicyVersion(row.id);
		const membershipResponse: MembershipResponse = mapMembershipToResponse(membership);

		return {
			tenantId: row.id,
			slug: row.slug,
			displayName: row.displayName,
			userId,
			membership: membershipResponse,
			policyVersion,
		};
	}

	public async getContext(userId: string, tenantSlug: string): Promise<TenantContextResponse> {
		const resolved = await this.resolveBySlug(userId, tenantSlug);

		return this.tenantTx.withTenantTransaction(
			{
				userId,
				tenantId: resolved.tenantId,
				purpose: "tenant.context",
				policyVersion: resolved.policyVersion,
			},
			async (tx) => {
				const org = await tx.tenant.findUnique({
					where: { id: resolved.tenantId },
					include: {
						locations: { where: { isDeleted: false } },
						merchantProfile: true,
						assets: TENANT_LOGO_ASSETS_SELECT,
					},
				});

				if (org === null) {
					throw new NotFoundException();
				}

				const primary = org.locations.find((l) => l.isPrimary) ?? org.locations[LIST_SLOT_INDEX.first];

				return {
					tenant: {
						id: org.id,
						slug: org.slug,
						displayName: org.displayName,
						lifecycleState: org.lifecycleState,
						primaryLocationId: primary?.id ?? null,
						createdAt: epochMs(Number(org.createdAt)),
						updatedAt: epochMs(Number(org.updatedAt)),
						// The zone merchant analytics are cut in — validated, never passed through unchecked.
						timeZone: IanaTimeZoneSchema.parse(org.timeZone),
						logo: mapTenantLogo(org.assets, this.publicUrls.resolve),
					},
					membership: resolved.membership,
					locations: org.locations.map((l) => mapLocationToResponse(l)),
					merchantProfile: org.merchantProfile
						? {
								tenantId: org.merchantProfile.tenantId,
								legalName: org.merchantProfile.legalName,
								category: org.merchantProfile.category,
								city: org.merchantProfile.city,
								kybStatus: org.merchantProfile.kybStatus,
								contactEmail: org.merchantProfile.contactEmail,
								contactPhone: org.merchantProfile.contactPhone,
							}
						: null,
					policyVersion: resolved.policyVersion,
				};
			},
		);
	}

	private buildActiveTenantWhere(routeKey: string): Prisma.TenantWhereInput {
		const slugMatches: Prisma.TenantWhereInput[] = [{ slug: routeKey }, { slugHistory: { some: { slug: routeKey } } }];

		if (UuidParamSchema.safeParse(routeKey).success) {
			return {
				isDeleted: false,
				lifecycleState: { notIn: ["DELETED", "PENDING_DELETION"] },
				OR: [{ id: routeKey }, ...slugMatches],
			};
		}

		return {
			isDeleted: false,
			lifecycleState: { notIn: ["DELETED", "PENDING_DELETION"] },
			OR: slugMatches,
		};
	}

	/** Ensures a location belongs to the tenant and is within the caller's membership scope. */
	public async assertAccessibleLocation(userId: string, tenantSlug: string, locationId: string): Promise<void> {
		const resolved = await this.resolveBySlug(userId, tenantSlug);

		const location = await this.tenantTx.withSystemOperation(
			{
				operation: "tenant.context.location_access",
				reason: "Validate tenant location access",
				actorUserId: userId,
			},
			async (tx) =>
				tx.location.findFirst({
					where: { id: locationId, tenantId: resolved.tenantId, isDeleted: false, status: "ACTIVE" },
					select: { id: true },
				}),
		);

		if (location === null) {
			throw new NotFoundException();
		}

		if (resolved.membership.locationScopeType === "SELECTED" && !resolved.membership.locationIds.includes(locationId)) {
			throw new ForbiddenException({
				message: "Location is outside your membership scope",
				error: "TENANT_LOCATION_FORBIDDEN",
			});
		}
	}

	public async assertActionAllowed(resolved: ResolvedTenantContext, action: string, resourceType: string, resourceId: string): Promise<void> {
		const decision = await this.cedar.evaluate({
			tenantId: resolved.tenantId,
			principal: {
				userId: resolved.userId,
				role: resolved.membership.role,
				locationScope: resolved.membership.locationScopeType,
				locationIds: resolved.membership.locationIds,
			},
			action,
		});

		await this.tenantTx.withTenantTransaction(
			{ userId: resolved.userId, tenantId: resolved.tenantId, purpose: `authorize.${action}`, policyVersion: decision.policyVersion },
			async (tx) =>
				this.audit.recordInTx(tx, {
					tenantId: resolved.tenantId,
					actorUserId: resolved.userId,
					action: `authorize.${action}`,
					resourceType,
					resourceId,
					decision: decision.decision,
					policyVersion: decision.policyVersion,
				}),
		);

		if (decision.decision !== "Allow") {
			throw new NotFoundException();
		}
	}
}
